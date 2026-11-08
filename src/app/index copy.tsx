import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Comptes par défaut si rien n'est enregistré
const COMPTES_INITIALAUX = [
  { id: '1', nom: 'Fortis', icone: 'bank', typeIcone: 'material' },
  { id: '2', nom: 'Revolut', icone: 'credit-card', typeIcone: 'material' },
  { id: '3', nom: 'Pluxee', icone: 'food-fork-drink', typeIcone: 'material' },
];

const STORAGE_KEY_COMPTES = '@mon_budget_comptes';

// Liste d'icônes proposées lors de la création d'un compte
const ICONES_DISPONIBLES = [
  { nom: 'bank', type: 'material' },
  { nom: 'credit-card', type: 'material' },
  { nom: 'wallet', type: 'material' },
  { nom: 'piggy-bank', type: 'material' },
  { nom: 'cash-multiple', type: 'material' },
  { nom: 'shield-account', type: 'material' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [comptes, setComptes] = useState(COMPTES_INITIALAUX);
  const [soldesComptes, setSoldesComptes] = useState({});
  
  // États pour le modal d'ajout de compte
  const [modalVisible, setModalVisible] = useState(false);
  const [nouveauNom, setNouveauNom] = useState('');
  const [nouveauSoldeInitial, setNouveauSoldeInitial] = useState('');
  const [iconeSelectionnee, setIconeSelectionnee] = useState('bank');

  // Charger les comptes et calculer les soldes à chaque retour sur la page
  useFocusEffect(
    React.useCallback(() => {
      chargerComptesEtSoldes();
    }, [])
  );

  const chargerComptesEtSoldes = async () => {
    try {
      // 1. Charger la liste des comptes personnalisés
      const comptesStockes = await AsyncStorage.getItem(STORAGE_KEY_COMPTES);
      let listeComptes = COMPTES_INITIALAUX;
      if (comptesStockes !== null) {
        listeComptes = JSON.parse(comptesStockes);
        setComptes(listeComptes);
      }

      // 2. Calculer le solde de chaque compte en fonction de ses transactions
      const soldesTemp = {};
      for (const compte of listeComptes) {
        const transStockes = await AsyncStorage.getItem(`@mon_budget_transactions_${compte.nom}`);
        if (transStockes !== null) {
          const trans = JSON.parse(transStockes);
          const total = trans.reduce((acc, curr) => acc + curr.montant, 0);
          soldesTemp[compte.nom] = total;
        } else {
          soldesTemp[compte.nom] = 0;
        }
      }
      setSoldesComptes(soldesTemp);
    } catch (e) {
      console.error("Erreur lors du chargement des données", e);
    }
  };

  // Ajouter un nouveau compte
  const ajouterCompte = async () => {
    if (!nouveauNom.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un nom de compte.");
      return;
    }

    // Vérifier si le compte existe déjà
    if (comptes.some(c => c.nom.toLowerCase() === nouveauNom.trim().toLowerCase())) {
      Alert.alert("Erreur", "Ce compte existe déjà.");
      return;
    }

    const nouveauCompteObj = {
      id: Date.now().toString(),
      nom: nouveauNom.trim(),
      icone: iconeSelectionnee,
      typeIcone: 'material',
    };

    const nouvelleListeComptes = [...comptes, nouveauCompteObj];
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(nouvelleListeComptes));
      
      // Si un solde initial a été entré, on crée une première transaction "Revenu" fictive
      const soldeInit = parseFloat(nouveauSoldeInitial);
      if (!isNaN(soldeInit) && soldeInit !== 0) {
        const transactionInitiale = [{
          id: Date.now().toString(),
          description: 'Solde initial',
          montant: soldeInit,
          type: soldeInit > 0 ? 'revenu' : 'depense',
          categorie: 'Autre',
          date: new Date().toLocaleDateString('fr-FR'),
        }];
        await AsyncStorage.setItem(`@mon_budget_transactions_${nouveauCompteObj.nom}`, JSON.stringify(transactionInitiale));
      }

      setComptes(nouvelleListeComptes);
      setNouveauNom('');
      setNouveauSoldeInitial('');
      setModalVisible(false);
      chargerComptesEtSoldes();
    } catch (e) {
      console.error("Erreur lors de l'enregistrement du compte", e);
    }
  };

  // Supprimer un compte
  const supprimerCompte = (nomCompte) => {
    Alert.alert(
      "Supprimer le compte",
      `Voulez-vous vraiment supprimer le compte "${nomCompte}" et toutes ses transactions ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const nouvelleListe = comptes.filter(c => c.nom !== nomCompte);
              await AsyncStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(nouvelleListe));
              await AsyncStorage.removeItem(`@mon_budget_transactions_${nomCompte}`);
              setComptes(nouvelleListe);
              chargerComptesEtSoldes();
            } catch (e) {
              console.error("Erreur suppression compte", e);
            }
          }
        }
      ]
    );
  };

  // Calcul du patrimoine net total
  const patrimoineTotal = Object.values(soldesComptes).reduce((acc, curr) => acc + curr, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Budget</Text>
        <Text style={styles.patrimoineLabel}>Patrimoine Net</Text>
        <Text style={[styles.patrimoineMontant, { color: patrimoineTotal >= 0 ? '#2ecc71' : '#e74c3c' }]}>
          {patrimoineTotal.toFixed(2)} €
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.listTitle}>Mes Comptes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={comptes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const solde = soldesComptes[item.nom] || 0;
          return (
            <TouchableOpacity 
              style={styles.compteCard}
              onPress={() => router.push({ pathname: '/detail', params: { nomCompte: item.nom } })}
              onLongPress={() => supprimerCompte(item.nom)}
              delayLongPress={500}
            >
              <View style={styles.compteInfo}>
                <View style={styles.iconeContainer}>
                  <MaterialCommunityIcons name={item.icone} size={24} color="#007AFF" />
                </View>
                <Text style={styles.compteNom}>{item.nom}</Text>
              </View>
              <Text style={[styles.compteSolde, { color: solde >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                {solde.toFixed(2)} €
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Modal d'ajout de compte */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Compte</Text>

            <TextInput
              style={styles.input}
              placeholder="Nom du compte (ex: Livret A, Cash...)"
              placeholderTextColor="#888"
              value={nouveauNom}
              onChangeText={setNouveauNom}
            />

            <TextInput
              style={styles.input}
              placeholder="Solde initial (ex: 150.00)"
              placeholderTextColor="#888"
              keyboardDataType="numeric"
              keyboardType="numeric"
              value={nouveauSoldeInitial}
              onChangeText={setNouveauSoldeInitial}
            />

            <Text style={styles.labelIcone}>Choisissez une icône :</Text>
            <View style={styles.iconesGrid}>
              {ICONES_DISPONIBLES.map((ic) => (
                <TouchableOpacity
                  key={ic.nom}
                  style={[styles.iconeOption, iconeSelectionnee === ic.nom && styles.iconeOptionSelected]}
                  onPress={() => setIconeSelectionnee(ic.nom)}
                >
                  <MaterialCommunityIcons 
                    name={ic.nom} 
                    size={24} 
                    color={iconeSelectionnee === ic.nom ? '#fff' : '#007AFF'} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={ajouterCompte}
              >
                <Text style={styles.confirmButtonText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  header: { alignItems: 'center', marginBottom: 20, backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, marginTop: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  patrimoineLabel: { fontSize: 14, color: '#666' },
  patrimoineMontant: { fontSize: 32, fontWeight: 'bold', marginTop: 5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  listTitle: { fontSize: 14, color: '#666', fontWeight: '600' },
  addButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },
  compteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2 },
  compteInfo: { flexDirection: 'row', alignItems: 'center' },
  iconeContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f2f6', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  compteNom: { fontSize: 16, fontWeight: '600', color: '#333' },
  compteSolde: { fontSize: 16, fontWeight: 'bold' },
  
  // Styles du Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16 },
  labelIcone: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  iconesGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  iconeOption: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#f1f2f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  iconeOptionSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f2f6', marginRight: 10 },
  cancelButtonText: { color: '#333', fontWeight: '600' },
  confirmButton: { backgroundColor: '#2ecc71', marginLeft: 10 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
});