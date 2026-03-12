import 'package:cloud_firestore/cloud_firestore.dart';
import 'current_user_service.dart';

class TouristDatabaseService {
  static const String collectionName = 'tourists';
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Future<Map<String, dynamic>?> getCurrentTourist() async {
    final current = CurrentUserService();
    if (current.email == null || current.dtid == null) {
      await current.loadFromAuth();
    }

    final email = current.email;
    final dtid = current.dtid;
    if (email == null || dtid == null) return null;

    final query = await _firestore
        .collection(collectionName)
        .where('email', isEqualTo: email)
        .where('dtid', isEqualTo: dtid)
        .limit(1)
        .get();

    if (query.docs.isEmpty) return null;
    return query.docs.first.data();
  }
}
