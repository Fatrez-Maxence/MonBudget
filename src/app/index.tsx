import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Import des icônes Expo

const INITIAL_COMPTES = [
  { 
    id: '1', 
    nom: 'Compte Courant', 
    couleur: '#007AFF', 
    iconeType: 'material', 
    iconeNom: 'bank', 
    badge: 'Fortis' 
  },
  { 
    id: '2', 
    nom: 'Compte Épargne', 
    couleur: '#2ecc71', 
    iconeType: 'material', 
    iconeNom: 'piggy-bank', 
    badge: 'Fortis' 
  },
  { 
    id: '3', 
    nom: 'Revolut Personnel', 
    couleur: '#9b59b6', 
    iconeType: 'ion', 
    iconeNom: 'card-outline', 
    badge: 'Revolut' 
  },
  { 
    id: '4', 
    nom: 'Revolut Joint', 
    couleur: '#e67e22', 
    iconeType: 'ion', 
    iconeNom: 'people-outline', 
    badge: 'Revolut' 
  },
  { 
    id: '5', 
    nom: 'Poche Revolut', 
    couleur: '#e74c3c', 
    iconeType: 'ion', 
    iconeNom: 'wallet-outline', 
    badge: 'Revolut' 
  },
  { 
    id: '6', 
    nom: 'Compte Pluxee', 
    couleur: '#f1c40f', 
    iconeType: 'material', 
    iconeNom: 'food-fork-drink', 
    badge: 'Pluxee' 
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [comptesAvecSoldes, setComptesAvecSoldes] = useState([]);

  useFocusEffect(
    useCallback(() => {
      chargerSoldesComptes();
    }, [])
  );

  const chargerSoldesComptes = async () => {
    const comptesMaj = await Promise.all(
      INITIAL_COMPTES.map(async (compte) => {
        try {
          const STORAGE_KEY = `@mon_budget_transactions_${compte.nom}`;
          const donnees = await AsyncStorage.getItem(STORAGE_KEY);
          if (donnees !== null) {
            const transactions = JSON.parse(donnees);
            const solde = transactions.reduce((acc, curr) => acc + curr.montant, 0);
            return { ...compte, solde };
          }
        } catch (e) {
          console.error(`Erreur pour le compte ${compte.nom}`, e);
        }
        return { ...compte, solde: 0 };
      })
    );
    setComptesAvecSoldes(comptesMaj);
  };

  const patrimoineTotal = comptesAvecSoldes.reduce((acc, curr) => acc + (curr.solde || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patrimoine Total</Text>
        <Text style={[styles.patrimoineText, { color: patrimoineTotal >= 0 ? '#111' : '#e74c3c' }]}>
          {patrimoineTotal.toFixed(2)} €
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Mes Comptes</Text>

      <FlatList
        data={comptesAvecSoldes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.compteCard}
            onPress={() => router.push({ pathname: '/detail', params: { nomCompte: item.nom } })}
          >
            <View style={styles.compteInfo}>
              {/* Conteneur de l'icône avec la couleur du compte */}
              <View style={[styles.iconContainer, { backgroundColor: item.couleur + '20' }]}>
                {item.iconeType === 'material' ? (
                  <MaterialCommunityIcons name={item.iconeNom} size={24} color={item.couleur} />
                ) : (
                  <Ionicons name={item.iconeNom} size={24} color={item.couleur} />
                )}
              </View>

              <View>
                <Text style={styles.compteNom}>{item.nom}</Text>
              </View>
            </View>

            <Text style={[styles.compteSolde, { color: (item.solde || 0) >= 0 ? '#2ecc71' : '#e74c3c' }]}>
              {(item.solde || 0).toFixed(2)} €
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  header: { alignItems: 'center', marginBottom: 25, marginTop: 15, backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  headerTitle: { fontSize: 16, color: '#666', marginBottom: 5 },
  patrimoineText: { fontSize: 32, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15 },
  compteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  compteInfo: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 45, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  compteNom: { fontSize: 16, fontWeight: '600', color: '#333' },
  compteBadge: { fontSize: 12, color: '#888', marginTop: 2, fontWeight: '500' },
  compteSolde: { fontSize: 16, fontWeight: 'bold' },
});