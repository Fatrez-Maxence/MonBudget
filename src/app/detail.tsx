import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const nomCompte = params.nomCompte as string || 'Compte';

  const [transactions, setTransactions] = useState([]);
  const [solde, setSolde] = useState(0);
  
  // États pour le modal d'ajout de transaction
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState('');
  const [type, setType] = useState('depense'); // 'depense' ou 'revenu'
  
  // Catégorie sélectionnée par défaut
  const [categorie, setCategorie] = useState('Alimentation');

  // Liste des catégories de dépenses avec leurs icônes associées
  const categoriesDisponibles = [
    { nom: 'Alimentation', icone: 'food-fork-knife' },
    { nom: 'Courses', icone: 'cart' },
    { nom: 'Loisirs', icone: 'controller-classic' },
    { nom: 'Factures', icone: 'file-document-outline' },
    { nom: 'Transport', icone: 'car' },
    { nom: 'Logement', icone: 'home' },
    { nom: 'Soins', icone: 'medical-bag' },
    { nom: 'Vacances', icone: 'airplane' },
    { nom: 'Autre', icone: 'dots-horizontal' },
  ];

  useEffect(() => {
    chargerTransactions();
  }, [nomCompte]);

  const chargerTransactions = async () => {
    try {
      const cleStorage = `@mon_budget_transactions_${nomCompte}`;
      const data = await AsyncStorage.getItem(cleStorage);
      if (data !== null) {
        const trans = JSON.parse(data);
        if (Array.isArray(trans)) {
          setTransactions(trans);
          const total = trans.reduce((acc, curr) => acc + curr.montant, 0);
          setSolde(total);
        } else {
          setTransactions([]);
          setSolde(0);
        }
      } else {
        setTransactions([]);
        setSolde(0);
      }
    } catch (e) {
      console.error("Erreur chargement transactions", e);
      setTransactions([]);
    }
  };

  const ajouterTransaction = async () => {
    if (!description.trim() || !montant.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    const valMontant = parseFloat(montant);
    if (isNaN(valMontant) || valMontant <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    let montantFinal = type === 'depense' ? -valMontant : valMontant;
    // Si c'est un revenu, on force la catégorie à "Revenu"
    const categorieFinale = type === 'revenu' ? 'Revenu' : categorie;

    const dateDuJour = new Date().toLocaleDateString('fr-FR');
    const idTransaction = Date.now().toString();

    let arrondiDiff = 0;
    let nomPocheCible = '';

    try {
      // --- VÉRIFICATION DYNAMIQUE DE L'OPTION ARRONDI DU COMPTE ---
      const comptesStockes = await AsyncStorage.getItem('@mon_budget_comptes');
      if (comptesStockes) {
        const listeComptes = JSON.parse(comptesStockes);
        const compteActuel = listeComptes.find((c: any) => (typeof c === 'object' ? c.nom : c) === nomCompte);
        
        if (compteActuel && typeof compteActuel === 'object' && compteActuel.arrondiActif && type === 'depense') {
          const montantAbs = Math.abs(valMontant);
          const montantArrondi = Math.ceil(montantAbs);
          
          let targetArrondi = montantArrondi;
          if (montantArrondi === montantAbs) {
            targetArrondi = montantAbs + 1;
          }

          arrondiDiff = targetArrondi - montantAbs;
          montantFinal = -targetArrondi;
          nomPocheCible = compteActuel.pocheCible || 'Poche Revolut';
        }
      }
    } catch (e) {
      console.error("Erreur vérification option arrondi", e);
    }
    // -------------------------------------------------------------

    const nouvelleTrans = {
      id: idTransaction,
      description: description.trim(),
      montant: montantFinal,
      type: type,
      categorie: categorieFinale,
      date: dateDuJour,
    };

    try {
      const cleStorage = `@mon_budget_transactions_${nomCompte}`;
      const nouvelleListe = [nouvelleTrans, ...transactions];
      
      await AsyncStorage.setItem(cleStorage, JSON.stringify(nouvelleListe));

      // Si un arrondi a eu lieu, on l'envoie dans la poche cible configurée
      if (arrondiDiff > 0.001 && nomPocheCible) {
        const clePoche = `@mon_budget_transactions_${nomPocheCible}`;
        
        const transPocheStockees = await AsyncStorage.getItem(clePoche);
        let listePoche = [];
        try {
          listePoche = transPocheStockees ? JSON.parse(transPocheStockees) : [];
          if (!Array.isArray(listePoche)) listePoche = [];
        } catch (err) {
          listePoche = [];
        }
        
        const nouveauGainPoche = {
          id: idTransaction + '_poche',
          description: `Arrondi (depuis ${nomCompte})`,
          montant: Number(arrondiDiff.toFixed(2)),
          type: 'revenu',
          categorie: 'Épargne / Arrondi',
          date: dateDuJour,
        };
        
        listePoche.unshift(nouveauGainPoche);
        await AsyncStorage.setItem(clePoche, JSON.stringify(listePoche));
      }

      setTransactions(nouvelleListe);
      setSolde(nouvelleListe.reduce((acc, curr) => acc + curr.montant, 0));
      
      // Réinitialiser et fermer
      setDescription('');
      setMontant('');
      setType('depense');
      setCategorie('Alimentation');
      setModalVisible(false);
    } catch (e) {
      console.error("Erreur enregistrement transaction", e);
    }
  };

  const supprimerTransaction = (id: string) => {
    Alert.alert(
      "Supprimer la transaction",
      "Voulez-vous vraiment supprimer cette transaction ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const nouvelleListe = transactions.filter((t: any) => t.id !== id);
              const cleStorage = `@mon_budget_transactions_${nomCompte}`;
              await AsyncStorage.setItem(cleStorage, JSON.stringify(nouvelleListe));
              setTransactions(nouvelleListe);
              setSolde(nouvelleListe.reduce((acc, curr) => acc + curr.montant, 0));
            } catch (e) {
              console.error("Erreur suppression transaction", e);
            }
          }
        }
      ]
    );
  };

  // Fonction utilitaire pour retrouver l'icône d'une catégorie dans l'historique
  const getIconeCategorie = (nomCat: string) => {
    if (nomCat === 'Revenu' || nomCat === 'Épargne / Arrondi') return 'cash-plus';
    const catObj = categoriesDisponibles.find(c => c.nom === nomCat);
    return catObj ? catObj.icone : 'tag';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre supérieure */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.compteTitre}>{nomCompte}</Text>
        <TouchableOpacity style={styles.analyseButton} onPress={() => router.push({ pathname: '/analyse', params: { nomCompte } })}>
          <MaterialCommunityIcons name="chart-bar" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Carte du Solde */}
      <View style={styles.soldeCard}>
        <Text style={styles.soldeLabel}>Solde actuel</Text>
        <Text style={[styles.soldeMontant, { color: solde >= 0 ? '#2ecc71' : '#e74c3c' }]}>
          {solde.toFixed(2)} €
        </Text>
      </View>

      {/* En-tête de la liste & Bouton d'ajout */}
      <View style={styles.sectionHeader}>
        <Text style={styles.listTitle}>Historique des transactions</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Liste des transactions */}
      <FlatList
        data={transactions}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity 
            style={styles.transactionCard}
            onPress={() => {
              Alert.alert(
                "Détails de la transaction",
                `Description : ${item.description}\n` +
                `Montant : ${item.montant > 0 ? `+${item.montant.toFixed(2)}` : item.montant.toFixed(2)} €\n` +
                `Catégorie : ${item.categorie}\n` +
                `Date : ${item.date}`,
                [{ text: "OK", style: "default" }]
              );
            }}
            onLongPress={() => supprimerTransaction(item.id)}
            delayLongPress={500}
          >
            <View style={styles.transLeft}>
              <View style={styles.transIconContainer}>
                <MaterialCommunityIcons name={getIconeCategorie(item.categorie)} size={20} color={item.montant >= 0 ? '#2ecc71' : '#007AFF'} />
              </View>
              <View>
                <Text style={styles.transDescription}>{item.description}</Text>
                <Text style={styles.transDetails}>{item.categorie} • {item.date}</Text>
              </View>
            </View>
            <Text style={[styles.transMontant, { color: item.montant >= 0 ? '#2ecc71' : '#e74c3c' }]}>
              {item.montant > 0 ? `+${item.montant.toFixed(2)}` : item.montant.toFixed(2)} €
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucune transaction pour le moment.</Text>
        }
      />

      {/* Modal d'ajout de transaction */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nouvelle Transaction</Text>

              {/* Sélecteur Type (Dépense / Revenu) */}
              <View style={styles.typeContainer}>
                <TouchableOpacity 
                  style={[styles.typeButton, type === 'depense' && styles.typeButtonDepenseActive]}
                  onPress={() => setType('depense')}
                >
                  <Text style={[styles.typeButtonText, type === 'depense' && styles.typeButtonTextActive]}>Dépense</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeButton, type === 'revenu' && styles.typeButtonRevenuActive]}
                  onPress={() => setType('revenu')}
                >
                  <Text style={[styles.typeButtonText, type === 'revenu' && styles.typeButtonTextActive]}>Revenu</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Description (ex: Restaurant, Salaire...)"
                placeholderTextColor="#888"
                value={description}
                onChangeText={setDescription}
              />

              <TextInput
                style={styles.input}
                placeholder="Montant (€)"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={montant}
                onChangeText={setMontant}
              />

              {/* Affichage conditionnel : Si c'est une dépense, on affiche les catégories. Si c'est un revenu, on n'affiche rien (catégorie "Revenu" par défaut) */}
              {type === 'depense' ? (
                <>
                  <Text style={styles.labelCategorie}>Catégorie :</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    {categoriesDisponibles.map((cat) => (
                      <TouchableOpacity
                        key={cat.nom}
                        style={[styles.catChip, categorie === cat.nom && styles.catChipSelected]}
                        onPress={() => setCategorie(cat.nom)}
                      >
                        <MaterialCommunityIcons 
                          name={cat.icone} 
                          size={16} 
                          color={categorie === cat.nom ? '#fff' : '#007AFF'} 
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.catChipText, categorie === cat.nom && styles.catChipTextSelected]}>
                          {cat.nom}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <View style={styles.revenuInfoBox}>
                  <MaterialCommunityIcons name="cash-plus" size={20} color="#2ecc71" style={{ marginRight: 8 }} />
                  <Text style={styles.revenuInfoText}>Catégorie automatique : <Text style={{ fontWeight: 'bold' }}>Revenu</Text></Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]} 
                  onPress={ajouterTransaction}
                >
                  <Text style={styles.confirmButtonText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 15,
    marginTop: 15,
  },
  backButton: { paddingVertical: 5 },
  backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  compteTitre: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  analyseButton: { padding: 5 },

  soldeCard: { alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  soldeLabel: { fontSize: 14, color: '#666' },
  soldeMontant: { fontSize: 32, fontWeight: 'bold', marginTop: 5 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  listTitle: { fontSize: 14, color: '#666', fontWeight: '600' },
  addButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },

  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2 },
  transLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  transIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f2f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transDescription: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 3 },
  transDetails: { fontSize: 12, color: '#888' },
  transMontant: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 14 },

  // Styles du Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, maxHeight: '85%', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  
  typeContainer: { flexDirection: 'row', marginBottom: 15, borderRadius: 8, backgroundColor: '#f1f2f6', padding: 3 },
  typeButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  typeButtonDepenseActive: { backgroundColor: '#e74c3c' },
  typeButtonRevenuActive: { backgroundColor: '#2ecc71' },
  typeButtonText: { fontWeight: '600', color: '#666' },
  typeButtonTextActive: { color: '#fff' },

  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16, backgroundColor: '#fff' },
  labelCategorie: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  categoriesScroll: { marginBottom: 20 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f2f6', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  catChipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  catChipText: { color: '#333', fontSize: 13, fontWeight: '500' },
  catChipTextSelected: { color: '#fff', fontWeight: 'bold' },

  revenuInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef9f2', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#d4edda' },
  revenuInfoText: { fontSize: 13, color: '#27ae60' },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f2f6', marginRight: 10 },
  cancelButtonText: { color: '#333', fontWeight: '600' },
  confirmButton: { backgroundColor: '#2ecc71', marginLeft: 10 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
});