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
  const [periode, setPeriode] = useState('mois_en_cours'); // 'mois_en_cours', 'mois_dernier', '3_derniers_mois', 'annee_en_cours'

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

  // 1. Logique de filtrage par période (basée sur ce qu'on a validé)
  const transactionsFiltrees = transactions.filter(t => {
    const maintenant = new Date();
    const [jour, mois, annee] = t.date.split('/');
    const dateTransaction = new Date(`${annee}-${mois}-${jour}`);

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

  // 2. Ne garder que les dépenses pour l'analyse par catégorie
  const depensesFiltrees = transactionsFiltrees.filter(t => t.type === 'depense');

  // 3. Agréger les dépenses par catégorie
  const totauxParCategorie = depensesFiltrees.reduce((acc, curr) => {
    acc[curr.categorie] = (acc[curr.categorie] || 0) + Math.abs(curr.montant);
    return acc;
  }, {});

  // Préparation des données pour le graphique en barres
  const categoriesLabels = Object.keys(totauxParCategorie);
  const categoriesValeurs = Object.values(totauxParCategorie);

  const dataGraphique = {
    labels: categoriesLabels.length > 0 ? categoriesLabels : ['Aucune'],
    datasets: [
      {
        data: categoriesValeurs.length > 0 ? categoriesValeurs : [0]
      }
    ]
  };

  const totalDepensesPeriode = categoriesValeurs.reduce((acc, curr) => acc + curr, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre du haut */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.compteTitre}>Analyse : {nomCompte}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Sélecteurs de période (Filtres) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtresContainer}>
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

        {/* Carte récapitulative de la période */}
        <View style={styles.cardResume}>
          <Text style={styles.cardResumeTitle}>Total des dépenses sur la période</Text>
          <Text style={styles.cardResumeMontant}>{totalDepensesPeriode.toFixed(2)} €</Text>
          <Text style={styles.cardResumeCount}>{depensesFiltrees.length} opération(s) enregistrée(s)</Text>
        </View>

        {/* Section Graphique */}
        <View style={styles.cardGraphique}>
          <Text style={styles.sectionTitle}>Répartition par catégorie</Text>
          {categoriesLabels.length > 0 ? (
            <BarChart
              data={dataGraphique}
              width={SCREEN_WIDTH - 60}
              height={220}
              yAxisSuffix=" €"
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                style: { borderRadius: 16 },
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              showValuesOnTopOfBars={true}
              fromZero={true}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucune dépense sur cette période.</Text>
            </View>
          )}
        </View>

        {/* Liste détaillée des montants par catégorie */}
        <View style={styles.cardDetails}>
          <Text style={styles.sectionTitle}>Détail par catégorie</Text>
          {Object.keys(totauxParCategorie).length > 0 ? (
            Object.keys(totauxParCategorie).map((cat) => (
              <View key={cat} style={styles.ligneDetail}>
                <Text style={styles.catNom}>{cat}</Text>
                <Text style={styles.catMontant}>{totauxParCategorie[cat].toFixed(2)} €</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Rien à afficher.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  backButton: { marginRight: 15, paddingVertical: 5 },
  backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  compteTitre: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  filtresContainer: { flexDirection: 'row', marginBottom: 15 },
  filtreChip: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#fff', borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#ddd' },
  filtreChipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filtreText: { color: '#333', fontSize: 14, fontWeight: '500' },
  filtreTextSelected: { color: '#fff', fontWeight: 'bold' },
  cardResume: { backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  cardResumeTitle: { fontSize: 14, color: '#666', marginBottom: 5 },
  cardResumeMontant: { fontSize: 28, fontWeight: 'bold', color: '#e74c3c', marginBottom: 5 },
  cardResumeCount: { fontSize: 12, color: '#888' },
  cardGraphique: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  cardDetails: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15, alignSelf: 'flex-start' },
  ligneDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  catNom: { fontSize: 15, color: '#333', fontWeight: '500' },
  catMontant: { fontSize: 15, fontWeight: 'bold', color: '#e74c3c' },
  emptyContainer: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#888', fontSize: 14, marginTop: 10 },
});