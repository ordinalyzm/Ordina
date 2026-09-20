package com.ordina.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelUuid;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "OrdinaBLE";
    public static final String MESH_CHANNEL_ID = "ordina_mesh_messages";
    public static final UUID SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_UUID    = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");

    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        checkPermissionsAndStartMesh();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Офлайн Mesh-сообщения";
            String description = "Мгновенные уведомления о сообщениях через Bluetooth Mesh без интернета";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(MESH_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public void showOfflineNotification(String title, String content, String senderId) {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (senderId != null) {
                intent.putExtra("open_chat_uid", senderId);
            }

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(this, (int) System.currentTimeMillis(), intent, flags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, MESH_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(content)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setContentIntent(pendingIntent);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                notificationManager.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error showing offline notification", e);
        }
    }

    private void checkPermissionsAndStartMesh() {
        List<String> requiredPermissions = new ArrayList<>();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requiredPermissions.add(Manifest.permission.BLUETOOTH_ADVERTISE);
            requiredPermissions.add(Manifest.permission.BLUETOOTH_SCAN);
            requiredPermissions.add(Manifest.permission.BLUETOOTH_CONNECT);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requiredPermissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        boolean allGranted = true;
        for (String perm : requiredPermissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted && !requiredPermissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, requiredPermissions.toArray(new String[0]), 101);
            return;
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

                    if (CHAR_UUID.equals(characteristic.getUuid()) && value != null) {
                        String rawJson = new String(value, StandardCharsets.UTF_8);
                        Log.i(TAG, ">>> ПРИНЯТО ОФЛАЙН СООБЩЕНИЕ ПО BLE: " + rawJson);

                        // Проверяем и запускаем нативное уведомление для экрана блокировки / офлайн режима
                        try {
                            JSONObject json = new JSONObject(rawJson);
                            String receiverId = json.optString("receiverId", "");
                            String senderName = json.optString("senderName", "Собеседник Mesh");
                            String senderId = json.optString("senderId", "");
                            String text = json.optString("text", "");
                            boolean isSilent = json.optBoolean("silent", false);

                            android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                            String myUid = prefs.getString("last_auth_uid", "");

                            if (!isSilent && !senderId.equals(myUid) && (receiverId.equals(myUid) || receiverId.isEmpty() || json.has("groupId"))) {
                                String displayBody = text.isEmpty() ? "Новое зашифрованное Mesh-сообщение" : text;
                                showOfflineNotification("Ordina Mesh: " + senderName, displayBody, senderId);
                            }
                        } catch (Exception parseErr) {
                            Log.w(TAG, "Failed to parse incoming BLE payload for notification", parseErr);
                        }

                        // Безопасная передача через экранирование JSON в WebView
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
                        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                        String myUid = prefs.getString("last_auth_uid", "unknown_peer");
                        String myName = prefs.getString("last_auth_name", "Узел");

                        // Отдаем JSON-визитку узла
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
