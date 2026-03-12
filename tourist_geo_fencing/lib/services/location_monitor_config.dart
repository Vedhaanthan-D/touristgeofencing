// Location monitoring configuration
class LocationMonitorConfig {
  // GPS accuracy threshold (±0.0045 degrees = ~500 meters)
  static const double latitudeThreshold = 0.0045;
  static const double longitudeThreshold = 0.0045;
  
  // Timing thresholds
  static const Duration testModeIdleDuration = Duration(minutes: 1);
  static const Duration productionModeIdleDuration = Duration(hours: 5);
  
  // Location update interval
  static const Duration locationUpdateInterval = Duration(minutes: 1);
  
  // Morning monitoring window
  static const int morningStartHour = 6;  // 6 AM
  static const int morningEndHour = 12;   // 12 PM
  
  // Current mode
  static bool isTestMode = true; // Set to false for production
  
  // Get current idle threshold based on mode
  static Duration get currentIdleThreshold => 
      isTestMode ? testModeIdleDuration : productionModeIdleDuration;
}

enum LocationMonitorStatus {
  inactive,
  active,
  idle,
  alertTriggered
}