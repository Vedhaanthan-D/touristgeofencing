import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../services/tourist_database_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Future<Map<String, dynamic>?> _future;

  @override
  void initState() {
    super.initState();
    _future = TouristDatabaseService().getCurrentTourist();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }
          final data = snapshot.data;
          if (data == null) {
            return const Center(child: Text('No tourist record found.'));
          }

          // Helper to format Firestore Timestamps or DateTimes
          String fmtDate(dynamic v) {
            if (v is Timestamp) return v.toDate().toString();
            if (v is DateTime) return v.toString();
            return v?.toString() ?? '-';
          }

          Widget buildTile(String title, String value, {IconData? icon}) {
            return ListTile(
              leading: icon != null ? Icon(icon) : null,
              title: Text(title),
              subtitle: Text(value.isEmpty ? '-' : value),
            );
          }

          final trip = (data['tripDetails'] as Map<String, dynamic>?) ?? {};
          final family = (data['familyMembers'] as List<dynamic>?) ?? const [];
          final emergency =
              (data['emergencyContacts'] as List<dynamic>?) ?? const [];

          return ListView(
            padding: const EdgeInsets.all(8),
            children: [
              Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ListTile(title: Text('Profile')),
                    const Divider(height: 0),
                    buildTile(
                      'Full name',
                      (data['fullName'] ?? '').toString(),
                      icon: Icons.person,
                    ),
                    buildTile(
                      'Gender',
                      (data['gender'] ?? '').toString(),
                      icon: Icons.wc,
                    ),
                    buildTile(
                      'Age',
                      (data['age'] ?? '').toString(),
                      icon: Icons.cake_outlined,
                    ),
                    buildTile(
                      'Email',
                      (data['email'] ?? '').toString(),
                      icon: Icons.email_outlined,
                    ),
                    buildTile(
                      'Mobile',
                      (data['mobileNumber'] ?? '').toString(),
                      icon: Icons.phone,
                    ),
                    buildTile(
                      'Aadhaar',
                      (data['aadhaar'] ?? '').toString(),
                      icon: Icons.badge_outlined,
                    ),
                    buildTile(
                      'DTID',
                      (data['dtid'] ?? '').toString(),
                      icon: Icons.vpn_key,
                    ),
                    buildTile(
                      'Is Active',
                      (data['isActive'] ?? '').toString(),
                      icon: Icons.verified_user,
                    ),
                    buildTile(
                      'Travellers',
                      (data['numberOfTravellers'] ?? '').toString(),
                      icon: Icons.groups_2_outlined,
                    ),
                    buildTile(
                      'Issued At (epoch?)',
                      (data['issuedAt'] ?? '').toString(),
                      icon: Icons.schedule,
                    ),
                    buildTile(
                      'Created At',
                      fmtDate(data['createdAt']),
                      icon: Icons.calendar_today_outlined,
                    ),
                    buildTile(
                      'Updated At',
                      fmtDate(data['updatedAt']),
                      icon: Icons.update,
                    ),
                  ],
                ),
              ),
              Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ListTile(title: Text('Trip details')),
                    const Divider(height: 0),
                    buildTile(
                      'Destination',
                      (trip['destination'] ?? '').toString(),
                      icon: Icons.place_outlined,
                    ),
                    buildTile(
                      'Start date',
                      fmtDate(trip['startDate']),
                      icon: Icons.play_arrow,
                    ),
                    buildTile(
                      'Return date',
                      fmtDate(trip['returnDate']),
                      icon: Icons.stop_circle_outlined,
                    ),
                  ],
                ),
              ),
              if (family.isNotEmpty)
                Card(
                  child: ExpansionTile(
                    title: const Text('Family members'),
                    children: [
                      for (final f in family)
                        ListTile(
                          leading: const Icon(Icons.family_restroom),
                          title: Text((f['fullName'] ?? '').toString()),
                          subtitle: Text(
                            'Age: ${f['age'] ?? '-'}  •  Gender: ${f['gender'] ?? '-'}',
                          ),
                        ),
                    ],
                  ),
                ),
              if (emergency.isNotEmpty)
                Card(
                  child: ExpansionTile(
                    title: const Text('Emergency contacts'),
                    children: [
                      for (final c in emergency)
                        ListTile(
                          leading: const Icon(Icons.contact_emergency_outlined),
                          title: Text((c['name'] ?? '').toString()),
                          subtitle: Text((c['phone'] ?? '').toString()),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
            ],
          );
        },
      ),
    );
  }
}
