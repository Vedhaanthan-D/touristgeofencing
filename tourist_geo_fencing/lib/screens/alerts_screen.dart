import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import '../services/current_user_service.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  bool _sending = false;
  bool _isHolding = false;

  Future<void> _ensureLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permissions are permanently denied');
    }
  }

  void _onLongPressStart() {
    if (_sending) return;
    setState(() => _isHolding = true);
  }

  Future<void> _onLongPressEnd() async {
    if (_sending) return;
    setState(() => _isHolding = false);
    // Haptic feedback on release
    try {
      await HapticFeedback.vibrate();
    } catch (_) {}
    // Trigger alert send
    if (mounted) {
      // Do not await to keep UI responsive; _sending state will show loader
      // ignore: discarded_futures
      _sendPanicAlert();
    }
  }

  Future<void> _sendPanicAlert() async {
    try {
      setState(() => _sending = true);

      await _ensureLocationPermission();
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      final user = FirebaseAuth.instance.currentUser;
      final email = user?.email ?? '';

      // Ensure current user context (dtid)
      await CurrentUserService().loadFromAuth();
      final dtid = CurrentUserService().dtid ?? '';

      final doc = {
        'dtid': dtid,
        'email': email,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'createdAt': FieldValue.serverTimestamp(),
        'uid': user?.uid,
        'source': 'mobile_app',
      };

      await FirebaseFirestore.instance
          .collection('panic_alert_emergencies')
          .add(doc);

      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Emergency alert sent')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to send alert: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Press in case of emergency',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onLongPressStart: (_) => _onLongPressStart(),
              onLongPressEnd: (_) => _onLongPressEnd(),
              child: AnimatedScale(
                scale: _isHolding ? 1.15 : 1.0,
                duration: const Duration(milliseconds: 140),
                curve: Curves.easeOutCubic,
                child: SizedBox(
                  width: 240,
                  height: 240,
                  child: ElevatedButton(
                    onPressed: null, // Use long-press only
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.red,
                      shape: const CircleBorder(),
                      elevation: 10,
                    ),
                    child: _sending
                        ? const SizedBox(
                            width: 48,
                            height: 48,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 3,
                            ),
                          )
                        : const Text(
                            'PANIC',
                            style: TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
