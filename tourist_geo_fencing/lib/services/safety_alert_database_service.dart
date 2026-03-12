import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/safety_alert.dart';

class SafetyAlertDatabaseService {
  static const String collectionName = 'safety_alerts';
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Create a new safety alert record
  Future<String> createSafetyAlert(SafetyAlert alert) async {
    try {
      final docRef = await _firestore
          .collection(collectionName)
          .add(alert.toFirestore());
      
      print('Safety alert created with ID: ${docRef.id}');
      return docRef.id;
    } catch (e) {
      print('Error creating safety alert: $e');
      rethrow;
    }
  }

  /// Update an existing safety alert with additional data
  Future<void> updateSafetyAlert(String alertId, Map<String, dynamic> updates) async {
    try {
      await _firestore
          .collection(collectionName)
          .doc(alertId)
          .update(updates);
      
      print('Safety alert updated: $alertId');
    } catch (e) {
      print('Error updating safety alert: $e');
      rethrow;
    }
  }

  /// Get all safety alerts for a specific user
  Future<List<SafetyAlert>> getUserSafetyAlerts(String userId) async {
    try {
      final querySnapshot = await _firestore
          .collection(collectionName)
          .where('userId', isEqualTo: userId)
          .orderBy('createdAt', descending: true)
          .get();

      return querySnapshot.docs
          .map((doc) => SafetyAlert.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error fetching user safety alerts: $e');
      return [];
    }
  }

  /// Get recent safety alerts for a user (last 30 days)
  Future<List<SafetyAlert>> getRecentSafetyAlerts(String userId, {int days = 30}) async {
    try {
      final cutoffDate = DateTime.now().subtract(Duration(days: days));
      
      final querySnapshot = await _firestore
          .collection(collectionName)
          .where('userId', isEqualTo: userId)
          .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(cutoffDate))
          .orderBy('createdAt', descending: true)
          .get();

      return querySnapshot.docs
          .map((doc) => SafetyAlert.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error fetching recent safety alerts: $e');
      return [];
    }
  }

  /// Get safety alerts within a specific date range
  Future<List<SafetyAlert>> getSafetyAlertsByDateRange(
    String userId,
    DateTime startDate,
    DateTime endDate,
  ) async {
    try {
      final querySnapshot = await _firestore
          .collection(collectionName)
          .where('userId', isEqualTo: userId)
          .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(startDate))
          .where('createdAt', isLessThanOrEqualTo: Timestamp.fromDate(endDate))
          .orderBy('createdAt', descending: true)
          .get();

      return querySnapshot.docs
          .map((doc) => SafetyAlert.fromFirestore(doc))
          .toList();
    } catch (e) {
      print('Error fetching safety alerts by date range: $e');
      return [];
    }
  }

  /// Get safety alerts within a geographic area
  Future<List<SafetyAlert>> getSafetyAlertsInArea(
    String userId,
    double centerLat,
    double centerLng,
    double radiusKm,
  ) async {
    try {
      // For simple rectangular bounds (more complex geo-queries need GeoFlutterFire)
      const double kmToDegrees = 0.009; // Approximate conversion
      final latDelta = (radiusKm * kmToDegrees);
      final lngDelta = (radiusKm * kmToDegrees);

      final querySnapshot = await _firestore
          .collection(collectionName)
          .where('userId', isEqualTo: userId)
          .where('location.latitude', isGreaterThan: centerLat - latDelta)
          .where('location.latitude', isLessThan: centerLat + latDelta)
          .get();

      // Filter by longitude in application (Firestore limitation)
      return querySnapshot.docs
          .map((doc) => SafetyAlert.fromFirestore(doc))
          .where((alert) => 
              (alert.longitude - centerLng).abs() <= lngDelta)
          .toList();
    } catch (e) {
      print('Error fetching safety alerts in area: $e');
      return [];
    }
  }

  /// Delete a safety alert
  Future<void> deleteSafetyAlert(String alertId) async {
    try {
      await _firestore
          .collection(collectionName)
          .doc(alertId)
          .delete();
      
      print('Safety alert deleted: $alertId');
    } catch (e) {
      print('Error deleting safety alert: $e');
      rethrow;
    }
  }

  /// Get safety alert statistics for a user
  Future<Map<String, dynamic>> getUserSafetyStats(String userId) async {
    try {
      final alerts = await getUserSafetyAlerts(userId);
      
      if (alerts.isEmpty) {
        return {
          'totalAlerts': 0,
          'averageIdleDuration': Duration.zero,
          'longestIdleDuration': Duration.zero,
          'mostRecentAlert': null,
        };
      }

      final totalDuration = alerts.fold<Duration>(
        Duration.zero,
        (sum, alert) => sum + alert.idleDuration,
      );

      final averageDuration = Duration(
        milliseconds: totalDuration.inMilliseconds ~/ alerts.length,
      );

      final longestDuration = alerts.fold<Duration>(
        Duration.zero,
        (max, alert) => alert.idleDuration > max ? alert.idleDuration : max,
      );

      return {
        'totalAlerts': alerts.length,
        'averageIdleDuration': averageDuration,
        'longestIdleDuration': longestDuration,
        'mostRecentAlert': alerts.first,
      };
    } catch (e) {
      print('Error fetching user safety stats: $e');
      return {
        'totalAlerts': 0,
        'averageIdleDuration': Duration.zero,
        'longestIdleDuration': Duration.zero,
        'mostRecentAlert': null,
      };
    }
  }

  /// Stream of real-time safety alerts for a user
  Stream<List<SafetyAlert>> getUserSafetyAlertsStream(String userId) {
    return _firestore
        .collection(collectionName)
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => 
            snapshot.docs.map((doc) => SafetyAlert.fromFirestore(doc)).toList()
        );
  }

  /// Batch create multiple safety alerts (for testing or data migration)
  Future<void> batchCreateSafetyAlerts(List<SafetyAlert> alerts) async {
    try {
      final batch = _firestore.batch();
      
      for (final alert in alerts) {
        final docRef = _firestore.collection(collectionName).doc();
        batch.set(docRef, alert.toFirestore());
      }
      
      await batch.commit();
      print('Batch created ${alerts.length} safety alerts');
    } catch (e) {
      print('Error batch creating safety alerts: $e');
      rethrow;
    }
  }
}