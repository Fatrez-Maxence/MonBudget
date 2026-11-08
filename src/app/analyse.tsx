import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AnalyseScreen() {
  const router = useRouter();
  const { nomCompte } = useLocalSearchParams();
  const STORAGE_KEY = `@mon_budget_transactions_${nomCompte}`;

  const [transactions, setTransactions] = useState([]);
  const [periode, setPeriode] = useState('mois_en_cours');

  useEffect(() => {
    chargerDonnees();
  }, [nomCompte]);

  const chargerDonnees = async () => {
    try {
      const donneesSauvegardees = await AsyncStorage.getItem(STORAGE_KEY);
      if (donneesSauvegardees !== null) {
        setTransactions(JSON.parse(donneesSauvegardees));
      }
    } catch (e) {
      console.error("Erreur lors du chargement des données", e);
    }
  };

  // Logique de filtrage par période
  const transactionsFiltrees = transactions.filter(t => {
    const maintenant = new Date();
    const [jour, mois, annee] = t.date.split('/');
    const dateTransaction = new Date(`${annee}-${mois}-${jour}`);

    if (isNaN(dateTransaction.getTime())) return false;

    if (periode === 'mois_en_cours') {
      return (
        dateTransaction.getMonth() === maintenant.getMonth() &&
        dateTransaction.getFullYear() === maintenant.getFullYear()
      );
    } 
    else if (periode === 'mois_dernier') {
      const moisDernier = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
      return (
        dateTransaction.getMonth() === moisDernier.getMonth() &&
        dateTransaction.getFullYear() === moisDernier.getFullYear()
      );
    }
    else if (periode === '3_derniers_mois') {
      const ilYATroisMois = new Date();
      ilYATroisMois.setMonth(maintenant.getMonth() - 3);
      return dateTransaction >= ilYATroisMois;
    }
    else if (periode === 'annee_en_cours') {
      return dateTransaction.getFullYear() === maintenant.getFullYear();
    }
    return true;
  });

  const depensesFiltrees = transactionsFiltrees.filter(t => t.type === 'depense');
  const recettesFiltrees = transactionsFiltrees.filter(t => t.type === 'revenu');

  const totauxDepensesParCategorie = depensesFiltrees.reduce((acc, curr) => {
    acc[curr.categorie] = (acc[curr.categorie] || 0) + Math.abs(curr.montant);
    return acc;
  }, {});

  const totauxRecettesParCategorie = recettesFiltrees.reduce((acc, curr) => {
    acc[curr.categorie] = (acc[curr.categorie] || 0) + Math.abs(curr.montant);
    return acc;
  }, {});

  const totalDepensesPeriode = Object.values(totauxDepensesParCategorie).reduce((acc, curr) => acc + curr, 0);
  const totalRecettesPeriode = Object.values(totauxRecettesParCategorie).reduce((acc, curr) => acc + curr, 0);
  const soldePeriode = totalRecettesPeriode - totalDepensesPeriode;

  const categoriesLabels = Object.keys(totauxDepensesParCategorie);
  const categoriesValeurs = Object.values(totauxDepensesParCategorie);

  const dataGraphique = {
    labels: categoriesLabels.length > 0 ? categoriesLabels : ['Aucune'],
    datasets: [{ data: categoriesValeurs.length > 0 ? categoriesValeurs : [0] }]
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre du haut */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.compteTitre} numberOfLines={1}>Analyse : {nomCompte}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* --- HAUT EN MODE SOMBRE (comme validé) --- */}
        <View style={styles.darkSection}>
          {/* Sélecteurs de période (Filtres) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtresContainer}>
            {[
              { id: 'mois_en_cours', label: 'Ce mois-ci' },
              { id: 'mois_dernier', label: 'Mois dernier' },
              { id: '3_derniers_mois', label: '3 derniers mois' },
              { id: 'annee_en_cours', label: 'Cette année' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.filtreChip, periode === item.id && styles.filtreChipSelected]}
                onPress={() => setPeriode(item.id)}
              >
                <Text style={[styles.filtreText, periode === item.id && styles.filtreTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cartes récapitulatives (Revenus vs Dépenses) */}
          <View style={styles.resumeContainerRow}>
            <View style={styles.cardResumeHalf}>
              <Text style={styles.cardResumeTitle}>Revenus</Text>
              <Text style={[styles.cardResumeMontant, { color: '#22c55e' }]}>+{totalRecettesPeriode.toFixed(2)} €</Text>
              <Text style={styles.cardResumeCount}>{recettesFiltrees.length} entrées</Text>
            </View>

            <View style={styles.cardResumeHalf}>
              <Text style={styles.cardResumeTitle}>Dépenses</Text>
              <Text style={[styles.cardResumeMontant, { color: '#ef4444' }]}>-{totalDepensesPeriode.toFixed(2)} €</Text>
              <Text style={styles.cardResumeCount}>{depensesFiltrees.length} sorties</Text>
            </View>
          </View>

          {/* Carte Bilan Net */}
          <View style={styles.cardBilan}>
            <Text style={styles.bilanTitle}>Bilan de la période</Text>
            <Text style={[styles.bilanMontant, { color: soldePeriode >= 0 ? '#22c55e' : '#ef4444' }]}>
              {soldePeriode >= 0 ? `+${soldePeriode.toFixed(2)} €` : `${soldePeriode.toFixed(2)} €`}
            </Text>
          </View>
        </View>

        {/* --- BAS SUR FOND BLANC (Graphique & Détails dans des blocs blancs sur fond sombre) --- */}
        <View style={styles.whiteCardsContainer}>
          {/* Section Graphique des Dépenses */}
          <View style={styles.cardGraphique}>
            <Text style={styles.sectionTitle}>Répartition des dépenses</Text>
            {categoriesLabels.length > 0 ? (
              <BarChart
                data={dataGraphique}
                width={SCREEN_WIDTH - 64}
                height={220}
                yAxisSuffix=" €"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                style={{ marginVertical: 8, borderRadius: 16 }}
                showValuesOnTopOfBars={true}
                fromZero={true}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="bar-chart-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Aucune dépense sur cette période.</Text>
              </View>
            )}
          </View>

          {/* Liste détaillée des Dépenses */}
          <View style={styles.cardDetails}>
            <Text style={styles.sectionTitle}>Détail des dépenses</Text>
            {Object.keys(totauxDepensesParCategorie).length > 0 ? (
              Object.keys(totauxDepensesParCategorie).map((cat) => (
                <View key={cat} style={styles.ligneDetail}>
                  <Text style={styles.catNom}>{cat}</Text>
                  <Text style={[styles.catMontant, { color: '#ef4444' }]}>-{totauxDepensesParCategorie[cat].toFixed(2)} €</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Aucune dépense.</Text>
            )}
          </View>

          {/* Liste détaillée des Revenus */}
          <View style={styles.cardDetails}>
            <Text style={styles.sectionTitle}>Détail des revenus</Text>
            {Object.keys(totauxRecettesParCategorie).length > 0 ? (
              Object.keys(totauxRecettesParCategorie).map((cat) => (
                <View key={cat} style={styles.ligneDetail}>
                  <Text style={styles.catNom}>{cat}</Text>
                  <Text style={[styles.catMontant, { color: '#22c55e' }]}>+{totauxRecettesParCategorie[cat].toFixed(2)} €</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Aucun revenu sur cette période.</Text>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16, paddingTop: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { marginRight: 15, paddingVertical: 5, backgroundColor: '#1e293b', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  backButtonText: { fontSize: 15, color: '#3b82f6', fontWeight: '600' },
  compteTitre: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  
  // Section supérieure en mode sombre
  darkSection: {
    marginBottom: 20,
  },
  filtresContainer: { flexDirection: 'row', marginBottom: 15, paddingVertical: 4 },
  filtreChip: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#1e293b', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#334155' },
  filtreChipSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filtreText: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },
  filtreTextSelected: { color: '#fff', fontWeight: 'bold' },
  
  resumeContainerRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  cardResumeHalf: { flex: 1, backgroundColor: '#1e293b', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cardResumeTitle: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  cardResumeMontant: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardResumeCount: { fontSize: 11, color: '#64748b' },
  
  cardBilan: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  bilanTitle: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  bilanMontant: { fontSize: 20, fontWeight: 'bold' },

  // Conteneur du bas : blocs blancs sur fond sombre global
  whiteCardsContainer: {
    gap: 15,
    paddingBottom: 30,
  },
  cardGraphique: { backgroundColor: '#ffffff', padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardDetails: { backgroundColor: '#ffffff', padding: 15, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, alignSelf: 'flex-start' },
  ligneDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  catNom: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  catMontant: { fontSize: 15, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 10 },
});