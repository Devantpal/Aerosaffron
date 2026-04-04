# 🌿 AeroSaffron – Smart Aeroponics System

AeroSaffron is a Full-stack IoT-based smart aeroponics system designed to monitor, control, and automate plant growth conditions using real-time cloud connectivity.

It integrates ESP32, Arduino UNO, sensors, Firebase Realtime Database, and a modern SaaS-style web dashboard to provide a complete smart farming solution.

---

# 🚀 Features

## 🌡️ Real-Time Monitoring

* Temperature (°C)
* Humidity (%)
* Light Intensity
* Water Level (%)

## 🎛️ Remote Device Control

* Mist Pump
* Fan
* LED Grow Light
* Cooling System (Peltier)

## 🤖 Automation System

* Automatic decision-making based on sensor data
* Configurable thresholds via web dashboard
* Smart scheduling (LED timing, mist cycles)

## 🔔 Alert System

* High temperature warning
* Low humidity alert
* Low water level detection
* Real-time alerts on dashboard

## 📊 Data Analytics

* Temperature & humidity graphs
* Historical trends
* CSV export support

## 🌐 SaaS Dashboard

* Modern UI/UX
* Fully responsive design
* Real-time sync with Firebase

---

# 🧠 System Architecture

```text
Frontend (Web Dashboard)
        ↓
Firebase Realtime Database
        ↓
ESP32 (Main Controller)
        ↓
Arduino UNO (Relay + Display Controller)
        ↓
Physical Devices (Pump, Fan, LED, Cooling System)
```



# ⚙️ Hardware Components

| Component                | Description                   |
| ------------------------ | ----------------------------- |
| ESP32                    | Main controller with WiFi     |
| Arduino UNO              | Relay + OLED controller       |
| DHT22                    | Temperature & humidity sensor |
| Light Sensor             | Measures light intensity      |
| Water Level Sensor       | Detects tank level            |
| Relay Module (4-channel) | Controls devices              |
| OLED Display             | Local display (Arduino)       |
| Logic Level Converter    | ESP32 ↔ Arduino communication |

---

# 🔌 Role Division

## 🟢 ESP32 (Main Brain)

* Connects to WiFi
* Sends & receives data from Firebase
* Reads sensors
* Executes automation logic
* Sends control signals to Arduino

## 🔵 Arduino UNO

* Controls relay module
* Drives OLED display
* Executes commands from ESP32

---

# ☁️ Firebase Integration

The system uses **Firebase Realtime Database** for:

* Real-time data synchronization
* Device control
* Storing sensor values
* Automation settings
* Alerts

---

## 📂 Database Structure

```json
{
  "aerosaffron": {
    "sensors": {
      "temperature": 25,
      "humidity": 60,
      "light": 200,
      "waterLevel": 50
    },
    "controls": {
      "pump": 0,
      "fan": 0,
      "light": 0,
      "peltier": 0
    },
    "settings": {
      "tempSet": 23,
      "humSet": 65,
      "mistDuration": 30,
      "mistInterval": 15,
      "ledStart": "06:00",
      "ledEnd": "22:00"
    },
    "alerts": {
      "msg": "System Normal"
    }
  }
}
```

---

# 🌐 Web Dashboard Modules

## 🟢 Dashboard

* Live sensor data cards
* Device status indicators
* Temperature & humidity graphs
* Quick control panel

## 🟡 Device Control

* Toggle ON/OFF:

  * Pump
  * Fan
  * Light
  * Cooling

## 🔵 Settings

* Temperature setpoint
* Humidity setpoint
* LED timing
* Mist duration & interval

## 🟣 Automation Rules

* IF–THEN logic system
* Example:

  * IF temperature > 24°C → Cooling ON
  * IF humidity < 50% → Pump ON

## 📊 Analytics

* Historical data visualization
* Graphs using Chart.js
* CSV download

## 🔔 Alerts

* Displays system warnings
* Real-time updates from Firebase

---

# 🔄 System Workflow

1. Sensors collect environmental data
2. ESP32 reads sensor values
3. Data is sent to Firebase
4. Web dashboard displays real-time data
5. User updates settings or controls devices
6. ESP32 reads updated values from Firebase
7. Automation logic is executed
8. Commands sent to Arduino
9. Arduino activates relays
10. Devices operate accordingly

---

# 🤖 Automation Logic

* Temperature > Setpoint → Fan ON
* Humidity < Setpoint → Pump ON
* LED controlled by schedule
* Mist system runs based on interval & duration
* Alerts generated when thresholds exceed

---

# 🎛️ Control Modes

## Manual Mode

* User directly controls devices via dashboard

## Automatic Mode

* System operates based on sensor data & rules

---

# 🔁 Real-Time Synchronization

* Uses Firebase `onValue()` listeners
* Instant updates without refresh
* Bidirectional sync:

  * Website → Firebase → ESP32
  * ESP32 → Firebase → Website

---

# 🎨 UI/UX Design

* Modern SaaS-style dashboard
* Sidebar navigation
* Card-based layout
* Responsive (mobile + desktop)
* Status badges (ACTIVE / INACTIVE)

---

# 📡 Communication Protocols

| Communication     | Method          |
| ----------------- | --------------- |
| ESP32 ↔ Firebase  | WiFi (HTTP)     |
| ESP32 ↔ Arduino   | Serial (TX/RX)  |
| Arduino ↔ Devices | Relay switching |

---

# 🔐 Security

* Firebase rules open for development
* Can be secured using:

  * Authentication
  * Role-based access

---

# 🚀 Future Enhancements

* 📱 Mobile App (Flutter)
* 🤖 AI-based anomaly detection
* 📲 Telegram / SMS alerts
* ⏱️ RTC for precise scheduling
* ☁️ Cloud deployment (AWS / Render)
* 👥 Multi-user support

---

# 📊 Project Outcome

* Real-time IoT monitoring system achieved
* Automated control reduces manual effort
* Efficient plant growth management
* Scalable cloud-based architecture

---

# 🎓 Conclusion

AeroSaffron demonstrates a **complete integration of IoT, cloud computing, and automation** for smart agriculture.

It showcases how modern technologies can be combined to create an **intelligent, scalable, and user-friendly farming solution**.

---

# 👨‍💻 Author

**AeroSaffron Team**
Final Year Project – Computer Science Engineering

---

# ⭐ If you like this project

Give it a ⭐ on GitHub and support smart agriculture 🌱

---
