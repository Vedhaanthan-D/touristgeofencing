import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CurrentUserService {
  static final CurrentUserService _instance = CurrentUserService._internal();
  factory CurrentUserService() => _instance;
  CurrentUserService._internal();

  String? uid;
  String? email;
  String? dtid;

  Future<void> loadFromAuth() async {
    final user = FirebaseAuth.instance.currentUser;
    uid = user?.uid;
    email = user?.email;
    // Load persisted DTID
    final prefs = await SharedPreferences.getInstance();
    dtid = prefs.getString('current_user_dtid');
  }

  Future<void> setFromAuth(User user, String dtidValue) async {
    uid = user.uid;
    email = user.email;
    dtid = dtidValue;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('current_user_dtid', dtidValue);
  }

  Future<void> clear() async {
    uid = null;
    email = null;
    dtid = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('current_user_dtid');
  }
}
