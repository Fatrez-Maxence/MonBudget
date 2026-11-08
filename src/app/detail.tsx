import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { nom: 'Courses', iconeType: 'material', iconeNom: 'shopping' },
  { nom: 'Transport', iconeType: 'material', iconeNom: 'car' },
  { nom: 'Factures', iconeType: 'ion', iconeNom: 'document-text-outline' },
  { nom: 'Soins', iconeType: 'material', iconeNom: 'needle' },
  { nom: 'Loisirs', iconeType: 'material', iconeNom: 'movie' },
  { nom: 'Restaurants', iconeType: 'material', iconeNom: 'food' },
  { nom: 'Vacances', iconeType: 'material', iconeNom: 'airplane-takeoff' },
  { nom: 'Autre', iconeType: 'ion', iconeNom: 'ellipsis-horizontal' },
];

export default function DetailCompteScreen() {
  const router = useRouter();
  const { nomCompte } = useLocalSearchParams();
  const STORAGE_KEY = `@mon_budget_transactions_${nomCompte}`;

  const [typeOperation, setTypeOperation] = useState('depense');
  const [montant, setMontant] = useState('');
  const [description, setDescription] = useState('');
  const [categorieSelectionnee, setCategorieSelectionnee] = useState('Courses');
  const [transactions, setTransactions] = useState([]);

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

  const sauvegarderDonnees = async (nouvellesTransactions) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nouvellesTransactions));
    } catch (e) {
      console.error("Erreur lors de la sauvegarde", e);
    }
  };

  const ajouterOperation = () => {
    if (!montant || !description) return;

    const valeurNumerique = parseFloat(montant);
    if (isNaN(valeurNumerique) || valeurNumerique <= 0) return;

    const montantFinal = typeOperation === 'depense' ? -valeurNumerique : valeurNumerique;

    const nouvelleTrans = {
      id: Date.now().toString(),
      description: description,
      montant: montantFinal,
      type: typeOperation,
      categorie: typeOperation === 'depense' ? categorieSelectionnee : 'Revenu',
      date: new Date().toLocaleDateString('fr-FR'),
    };

    const nouvellesTransactions = [nouvelleTrans, ...transactions];
    setTransactions(nouvellesTransactions);
    sauvegarderDonnees(nouvellesTransactions);
    
    setMontant('');
    setDescription('');
  };

  const supprimerTransaction = (id) => {
    const nouvellesTransactions = transactions.filter(t => t.id !== id);
    setTransactions(nouvellesTransactions);
    sauvegarderDonnees(nouvellesTransactions);
  };

  // Fonction pour afficher les détails (appelée au clic simple)
  const afficherDetails = (item) => {
    Alert.alert(
      "Détails de l'opération",
      `Type : ${item.type === 'revenu' ? 'Revenu' : 'Dépense'}\nDescription : ${item.description}\nMontant : ${Math.abs(item.montant).toFixed(2)} €\nCatégorie : ${item.categorie}\nDate : ${item.date || 'N/A'}`
    );
  };

  // Fonction pour les options (appelée à l'appui long)
  const gererAppuiLong = (item) => {
    Alert.alert(
      "Options de l'opération",
      `Que voulez-vous faire pour "${item.description}" ?`,
      [
        {
          text: "Consulter les détails",
          onPress: () => afficherDetails(item)
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => supprimerTransaction(item.id)
        },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  const soldeTotal = transactions.reduce((acc, curr) => acc + curr.montant, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.compteTitre}>{nomCompte}</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Solde du compte</Text>
        <Text style={[styles.soldeText, { color: soldeTotal >= 0 ? '#2ecc71' : '#e74c3c' }]}>
          {soldeTotal.toFixed(2)} €
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, typeOperation === 'depense' && styles.tabDepenseActive]}
            onPress={() => setTypeOperation('depense')}
          >
            <Text style={[styles.tabText, typeOperation === 'depense' && styles.tabTextActive]}>Dépense</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, typeOperation === 'revenu' && styles.tabRevenuActive]}
            onPress={() => setTypeOperation('revenu')}
          >
            <Text style={[styles.tabText, typeOperation === 'revenu' && styles.tabTextActive]}>Revenu</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={typeOperation === 'depense' ? "Ex: Colruyt, Restaurant..." : "Ex: Salaire, Remboursement..."}
          placeholderTextColor="#888"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Montant (ex: 25.00)"
          placeholderTextColor="#888"
          keyboardType="numeric"
          value={montant}
          onChangeText={setMontant}
        />

        {typeOperation === 'depense' && (
          <>
            <Text style={styles.labelCategorie}>Catégorie :</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {CATEGORIES.map((cat) => {
                const estSelectionne = categorieSelectionnee === cat.nom;
                return (
                  <TouchableOpacity
                    key={cat.nom}
                    style={[styles.chip, estSelectionne && styles.chipSelected]}
                    onPress={() => setCategorieSelectionnee(cat.nom)}
                  >
                    {cat.iconeType === 'material' ? (
                      <MaterialCommunityIcons 
                        name={cat.iconeNom} 
                        size={18} 
                        color={estSelectionne ? '#fff' : '#007AFF'} 
                        style={{ marginRight: 6 }}
                      />
                    ) : (
                      <Ionicons 
                        name={cat.iconeNom} 
                        size={18} 
                        color={estSelectionne ? '#fff' : '#007AFF'} 
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={[styles.chipText, estSelectionne && styles.chipTextSelected]}>
                      {cat.nom}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: typeOperation === 'depense' ? '#e74c3c' : '#2ecc71' }]} 
          onPress={ajouterOperation}
        >
          <Text style={styles.buttonText}>
            {typeOperation === 'depense' ? "Ajouter la dépense" : "Ajouter le revenu"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Historique (Cliquez pour détails, appui long pour options)</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => afficherDetails(item)}
            onLongPress={() => gererAppuiLong(item)} 
            delayLongPress={500}
          >
            <View style={styles.transactionItem}>
              <View>
                <Text style={styles.itemDesc}>{item.description}</Text>
                <Text style={styles.itemCategorie}>{item.categorie} • {item.date}</Text>
              </View>
              <Text style={[styles.itemMontant, { color: item.montant > 0 ? '#2ecc71' : '#e74c3c' }]}>
                {item.montant > 0 ? `+${item.montant.toFixed(2)}` : item.montant.toFixed(2)} €
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButton: { marginRight: 15, paddingVertical: 5 },
  backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  compteTitre: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  header: { alignItems: 'center', marginBottom: 15, backgroundColor: '#fff', padding: 15, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  headerTitle: { fontSize: 14, color: '#666' },
  soldeText: { fontSize: 30, fontWeight: 'bold' },
  form: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  tabsContainer: { flexDirection: 'row', marginBottom: 15, backgroundColor: '#f1f2f6', borderRadius: 8, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabDepenseActive: { backgroundColor: '#e74c3c' },
  tabRevenuActive: { backgroundColor: '#2ecc71' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 10, fontSize: 16 },
  labelCategorie: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: '600' },
  categoriesContainer: { flexDirection: 'row', marginBottom: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f2f6', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#dfe4ea' },
  chipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { color: '#333', fontSize: 14 },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  button: { padding: 12, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  listTitle: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  transactionItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  itemDesc: { fontSize: 16, fontWeight: '600' },
  itemCategorie: { fontSize: 12, color: '#888', marginTop: 2 },
  itemMontant: { fontSize: 16, fontWeight: 'bold' },
});