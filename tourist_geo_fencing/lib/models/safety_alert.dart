import 'package:cloud_firestore/cloud_firestore.dart';

class SafetyAlert {
  final String? id;
  final String userId;
  final String dtid;
  final double latitude;
  final double longitude;
  final DateTime idleStartTimestamp;
  final Duration idleDuration;
  final Map<String, dynamic>? geminiAnalysis;
  final DateTime createdAt;

  SafetyAlert({
    this.id,
    required this.userId,
    required this.dtid,
    required this.latitude,
    required this.longitude,
    required this.idleStartTimestamp,
    required this.idleDuration,
    this.geminiAnalysis,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  // Convert to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'userId': userId,
      'dtid': dtid,
      'location': {
        'latitude': latitude,
        'longitude': longitude,
      },
      'idleStartTimestamp': Timestamp.fromDate(idleStartTimestamp),
      'idleDuration': idleDuration.inMilliseconds,
      'geminiAnalysis': geminiAnalysis,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }

  // Create from Firestore document
  factory SafetyAlert.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    final location = data['location'] as Map<String, dynamic>;
    
    return SafetyAlert(
      id: doc.id,
      userId: data['userId'],
      dtid: data['dtid'] ?? '',
      latitude: location['latitude'].toDouble(),
      longitude: location['longitude'].toDouble(),
      idleStartTimestamp: (data['idleStartTimestamp'] as Timestamp).toDate(),
      idleDuration: Duration(milliseconds: data['idleDuration']),
      geminiAnalysis: data['geminiAnalysis'],
      createdAt: (data['createdAt'] as Timestamp).toDate(),
    );
  }

  @override
  String toString() {
    return 'SafetyAlert{userId: $userId, dtid: $dtid, location: ($latitude, $longitude), duration: $idleDuration}';
  }
}

class UserLocation {
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double accuracy;

  UserLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    required this.accuracy,
  });

  @override
  String toString() {
    return 'UserLocation{lat: $latitude, lng: $longitude, time: $timestamp, accuracy: $accuracy}';
  }
}

class IdleSession {
  final UserLocation initialLocation;
  final DateTime startTime;
  DateTime lastUpdateTime;
  
  IdleSession({
    required this.initialLocation,
    required this.startTime,
  }) : lastUpdateTime = startTime;

  Duration get currentDuration => DateTime.now().difference(startTime);

  void updateLastSeen() {
    lastUpdateTime = DateTime.now();
  }
}