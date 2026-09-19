package com.ordina.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.os.Bundle;
import android.os.ParcelUuid;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "OrdinaBLE";
    // Сервисный UUID нашего мессенджера (16-битный короткий для экономии байт)
    public static final UUID ORDINA_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    private BluetoothLeAdvertiser advertiser;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startAdvertisingNode();
    }

    public void startAdvertisingNode() {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                Log.e(TAG, "Bluetooth выключен или не поддерживается");
                return;
            }

            advertiser = adapter.getBluetoothLeAdvertiser();
            if (advertiser == null) {
                Log.e(TAG, "Устройство не поддерживает режим BLE Peripheral (Advertising)");
                return;
            }

            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                    .setConnectable(true)
                    .build();

            // Вещаем имя устройства в эфир (ORD_<UID>)
            // Берем первые 8 символов Android ID для уникальности узла
            String androidId = android.provider.Settings.Secure.getString(getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            String nodeName = "ORD_" + (androidId != null ? androidId.substring(0, Math.min(8, androidId.length())) : "NODE");

            try {
                adapter.setName(nodeName);
            } catch (SecurityException e) {
                Log.w(TAG, "Не удалось изменить имя адаптера: " + e.getMessage());
            }

            AdvertiseData data = new AdvertiseData.Builder()
                    .setIncludeDeviceName(true)
                    .addServiceUuid(new ParcelUuid(ORDINA_UUID))
                    .build();

            advertiser.startAdvertising(settings, data, new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    Log.i(TAG, ">>> BLE МАЯК УСПЕШНО ЗАПУЩЕН! Имя узла: " + nodeName);
                }

                @Override
                public void onStartFailure(int errorCode) {
                    Log.e(TAG, ">>> Ошибка запуска BLE маяка. Код: " + errorCode);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "startAdvertisingNode exception: " + e.getMessage(), e);
        }
    }
}
