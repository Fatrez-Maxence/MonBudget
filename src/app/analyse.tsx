import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function AnalyseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const nomCompte = params.nomCompte as string || 'Compte';

  const [totalDepenses, setTotalDepenses] = useState(0);
  const [totalRevenus, setTotalRevenus] = useState(0);
  const [repartitionCategories, setRepartitionCategories] = useState<any[]>([]);

  useEffect(() => {
    analyserTransactions();
  }, [nomCompte]);

  const analyserTransactions = async () => {
    try {
      const cleTrans = `@mon_budget_transactions_${nomCompte}`;
      const dataTrans = await AsyncStorage.getItem(cleTrans);
      let listeTrans = dataTrans ? JSON.parse(dataTrans) : [];
      if (!Array.isArray(listeTrans)) listeTrans = [];

      let somDepenses = 0;
      let somRevenus = 0;
      const categoriesMap: { [key: string]: number } = {};

      listeTrans.forEach((t: any) => {
        if (t.montant < 0) {
          const montantAbs = Math.abs(t.montant);
          somDepenses += montantAbs;
          const cat = t.categorie || 'Autre';
          categoriesMap[cat] = (categoriesMap[cat] || 0) + montantAbs;
        } else {
          somRevenus += t.montant;
        }
      });

      const tableauCategories = Object.keys(categoriesMap).map((cat) => ({
        categorie: cat,
        montant: categoriesMap[cat],
        pourcentage: somDepenses > 0 ? (categoriesMap[cat] / somDepenses) * 100 : 0,
      })).sort((a, b) => b.montant - a.montant);

      setTotalDepenses(somDepenses);
      setTotalRevenus(somRevenus);
      setRepartitionCategories(tableauCategories);

    } catch (e) {
      console.error("Erreur lors de l'analyse des transactions", e);
    }
  };

  const getIconeCategorie = (nomCat: string) => {
    const icones: { [key: string]: string } = {
      'Alimentation': 'food',
      'Courses': 'cart',
      'Loisirs': 'controller-classic',
      'Factures': 'file-document-outline',
      'Transport': 'car',
      'Logement': 'home',
      'Soins': 'medical-bag',
      'Vacances': 'airplane',
      'Autre': 'dots-horizontal',
      'Virement': 'swap-horizontal',
      'Épargne / Arrondi': 'piggy-bank'
    };
    return icones[nomCat] || 'tag';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* En-tête style Néo-banque */}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.compteTitre}>Analyse • {nomCompte}</Text>
          <View style={styles.emptyHeaderIcon} />
        </View>

        <View style={styles.resumeContainer}>
          <View style={styles.resumeCard}>
            <View style={[styles.resumeIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <MaterialCommunityIcons name="arrow-down-thick" size={18} color="#f87171" />
            </View>
            <View>
              <Text style={styles.resumeLabel}>Dépenses totales</Text>
              <Text style={styles.resumeMontantDepense}>-{totalDepenses.toFixed(2)} €</Text>
            </View>
          </View>

          <View style={styles.resumeCard}>
            <View style={[styles.resumeIconBox, { backgroundColor: 'rgba(52, 211, 153, 0.1)' }]}>
              <MaterialCommunityIcons name="arrow-up-thick" size={18} color="#34d399" />
            </View>
            <View>
              <Text style={styles.resumeLabel}>Revenus totaux</Text>
              <Text style={styles.resumeMontantRevenu}>+{totalRevenus.toFixed(2)} €</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Corps de la page : Répartition par catégorie */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        <Text style={styles.sectionTitle}>Répartition des dépenses</Text>

        {repartitionCategories.length > 0 ? (
          repartitionCategories.map((item, index) => (
            <View key={index} style={styles.catCard}>
              <View style={styles.catCardLeft}>
                <View style={styles.catIconContainer}>
                  <MaterialCommunityIcons name={getIconeCategorie(item.categorie)} size={20} color="#2563eb" />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={styles.catHeaderRow}>
                    <Text style={styles.catNom}>{item.categorie}</Text>
                    <Text style={styles.catMontant}>-{item.montant.toFixed(2)} €</Text>
                  </View>
                  
                  <View style={styles.progressBackground}>
                    <View style={[styles.progressFill, { width: `${item.pourcentage}%` }]} />
                  </View>
                  
                  <Text style={styles.catPourcentage}>{item.pourcentage.toFixed(1)}% des dépenses</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="chart-pie" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Aucune dépense à analyser pour le moment.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  header: { 
    backgroundColor: '#0f172a', 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  compteTitre: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyHeaderIcon: { width: 36, height: 36 },

  resumeContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  resumeCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 12, borderRadius: 16, marginHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  resumeIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  resumeLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  resumeMontantDepense: { fontSize: 14, fontWeight: '700', color: '#f87171', marginTop: 2 },
  resumeMontantRevenu: { fontSize: 14, fontWeight: '700', color: '#34d399', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 14, letterSpacing: -0.2 },

  catCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  catCardLeft: { flexDirection: 'row', alignItems: 'flex-start' },
  catIconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catNom: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  catMontant: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  
  progressBackground: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },
  catPourcentage: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '500', marginTop: 10 },
});