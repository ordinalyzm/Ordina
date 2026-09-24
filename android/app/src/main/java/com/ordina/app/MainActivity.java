package com.ordina.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelUuid;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "OrdinaBLE";
    public static final UUID SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_UUID    = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");

    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkPermissionsAndStartMesh();
    }

    private void checkPermissionsAndStartMesh() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            String[] permissions = {
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            };

            boolean allGranted = true;
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }

            if (!allGranted) {
                ActivityCompat.requestPermissions(this, permissions, 101);
                return;
            }
        }
        startMeshEngine();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 101) {
            startMeshEngine();
        }
    }

    private void startMeshEngine() {
        BluetoothManager manager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager == null) return;
        BluetoothAdapter adapter = manager.getAdapter();

        if (adapter == null || !adapter.isEnabled()) return;

        setupGattServer(manager);

        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) return;

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .build();

        AdvertiseData data = new AdvertiseData.Builder()
                .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                .setIncludeDeviceName(false)
                .build();

        try {
            advertiser.startAdvertising(settings, data, new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    Log.i(TAG, ">>> [УСПЕХ] BLE МАЯК РАБОТАЕТ В ЭФИРЕ!");
                }
                @Override
                public void onStartFailure(int errorCode) {
                    Log.e(TAG, ">>> [ОШИБКА] Код ошибки маяка: " + errorCode);
                }
            });
        } catch (SecurityException ignored) {}
    }

    private void setupGattServer(BluetoothManager manager) {
        try {
            gattServer = manager.openGattServer(this, new BluetoothGattServerCallback() {
                @Override
                public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
                    super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value);

                    if (CHAR_UUID.equals(characteristic.getUuid())) {
                        String rawJson = new String(value, StandardCharsets.UTF_8);
                        Log.i(TAG, ">>> ПРИНЯТО ОФЛАЙН СООБЩЕНИЕ ПО BLE: " + rawJson);

                        // Безопасный проброс JSON в WebView
                        runOnUiThread(() -> {
                            String safeQuotedJson = org.json.JSONObject.quote(rawJson);
                            String jsCode = "try { " +
                                    "window.dispatchEvent(new CustomEvent('mesh:incoming_raw', { detail: JSON.parse(" + safeQuotedJson + ") })); " +
                                    "} catch(e) { console.error('[OrdinaBLE] JS eval error', e); }";
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                getBridge().getWebView().evaluateJavascript(jsCode, null);
                            }
                        });

                        if (responseNeeded) {
                            gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                        }
                    }
                }

                @Override
                public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic characteristic) {
                    super.onCharacteristicReadRequest(device, requestId, offset, characteristic);
                    if (CHAR_UUID.equals(characteristic.getUuid())) {
                        // Отдаем визитку: UID + Никнейм
                        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                        String myUid = prefs.getString("last_auth_uid", "unknown_peer");
                        String myName = prefs.getString("last_auth_name", "Узел");

                        String handshakeJson = "{\"uid\":\"" + myUid + "\",\"name\":\"" + myName + "\"}";
                        byte[] responseBytes = handshakeJson.getBytes(StandardCharsets.UTF_8);
                        gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, responseBytes);
                    }
                }
            });

            BluetoothGattService service = new BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
            BluetoothGattCharacteristic charac = new BluetoothGattCharacteristic(
                    CHAR_UUID,
                    BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_READ,
                    BluetoothGattCharacteristic.PERMISSION_WRITE | BluetoothGattCharacteristic.PERMISSION_READ
            );
            service.addCharacteristic(charac);
            gattServer.addService(service);
            Log.i(TAG, ">>> GATT СЕРВЕР ЗАПУЩЕН");
        } catch (SecurityException ignored) {}
    }
}
