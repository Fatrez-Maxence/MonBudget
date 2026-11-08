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
  const [prelevements, setPrelevements] = useState([]);
  
  // États pour le modal d'ajout de transaction manuelle
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState('');
  const [type, setType] = useState('depense');
  const [categorie, setCategorie] = useState('Alimentation');

  // États pour le modal de gestion des prélèvements récurrents
  const [prelevementModalVisible, setPrelevementModalVisible] = useState(false);
  const [nomPrelevement, setNomPrelevement] = useState('');
  const [montantPrelevement, setMontantPrelevement] = useState('');
  const [jourPrelevement, setJourPrelevement] = useState('');
  const [catPrelevement, setCatPrelevement] = useState('Factures');

  const categoriesDisponibles = [
    { nom: 'Alimentation', icone: 'food' },
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
    chargerDonneesEtVerifierPrelevements();
  }, [nomCompte]);

  // Chargement des transactions, des prélèvements et vérification automatique des échéances
  const chargerDonneesEtVerifierPrelevements = async () => {
    try {
      const cleTrans = `@mon_budget_transactions_${nomCompte}`;
      const clePrel = `@mon_budget_prelevements_${nomCompte}`;

      const dataTrans = await AsyncStorage.getItem(cleTrans);
      const dataPrel = await AsyncStorage.getItem(clePrel);

      let listeTrans = dataTrans ? JSON.parse(dataTrans) : [];
      if (!Array.isArray(listeTrans)) listeTrans = [];

      let listePrel = dataPrel ? JSON.parse(dataPrel) : [];
      if (!Array.isArray(listePrel)) listePrel = [];

      // --- VÉRIFICATION AUTOMATIQUE DES PRÉLÈVEMENTS RÉCURRENTS ---
      const maintenant = new Date();
      const jourActuel = maintenant.getDate();
      const moisActuel = maintenant.getMonth(); // 0 à 11
      const anneeActuelle = maintenant.getFullYear();
      const dateFormatee = maintenant.toLocaleDateString('fr-FR');

      let desModifications = false;

      listePrel = listePrel.map((prel: any) => {
        // On vérifie si on a atteint ou dépassé le jour du mois prévu
        if (jourActuel >= prel.jour) {
          // On regarde si ce prélèvement a déjà été appliqué pour ce mois/année
          const dernierAppel = prel.dernierMoisApplique ? new Date(prel.dernierMoisApplique) : null;
          const dejaFaitCeMois = dernierAppel && 
            dernierAppel.getMonth() === moisActuel && 
            dernierAppel.getFullYear() === anneeActuelle;

          if (!dejaFaitCeMois) {
            // Création de la transaction automatique de prélèvement
            const idAuto = 'prel_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const nouvelleTransAuto = {
              id: idAuto,
              description: `[Prélèvement] ${prel.nom}`,
              montant: -Math.abs(prel.montant),
              type: 'depense',
              categorie: prel.categorie || 'Factures',
              date: dateFormatee,
            };

            listeTrans.unshift(nouvelleTransAuto);
            desModifications = true;
            return { ...prel, dernierMoisApplique: maintenant.toISOString() };
          }
        }
        return prel;
      });

      if (desModifications) {
        await AsyncStorage.setItem(cleTrans, JSON.stringify(listeTrans));
        await AsyncStorage.setItem(clePrel, JSON.stringify(listePrel));
      }
      // -----------------------------------------------------------

      setTransactions(listeTrans);
      setPrelevements(listePrel);
      const total = listeTrans.reduce((acc: number, curr: any) => acc + curr.montant, 0);
      setSolde(total);

    } catch (e) {
      console.error("Erreur chargement données et prélèvements", e);
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
    const categorieFinale = type === 'revenu' ? 'Revenu' : categorie;
    const dateDuJour = new Date().toLocaleDateString('fr-FR');
    const idTransaction = Date.now().toString();

    let arrondiDiff = 0;
    let nomPocheCible = '';

    try {
      const comptesStockes = await AsyncStorage.getItem('@mon_budget_comptes');
      if (comptesStockes) {
        const listeComptes = JSON.parse(comptesStockes);
        const compteActuel = listeComptes.find((c: any) => (typeof c === 'object' ? c.nom : c) === nomCompte);
        
        if (compteActuel && typeof compteActuel === 'object' && compteActuel.arrondiActif && type === 'depense') {
          const montantAbs = Math.abs(valMontant);
          const montantArrondi = Math.ceil(montantAbs);
          let targetArrondi = montantArrondi === montantAbs ? montantAbs + 1 : montantArrondi;

          arrondiDiff = targetArrondi - montantAbs;
          montantFinal = -targetArrondi;
          nomPocheCible = compteActuel.pocheCible || 'Poche Revolut';
        }
      }
    } catch (e) {
      console.error("Erreur vérification arrondi", e);
    }

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

      if (arrondiDiff > 0.001 && nomPocheCible) {
        const clePoche = `@mon_budget_transactions_${nomPocheCible}`;
        const transPocheStockees = await AsyncStorage.getItem(clePoche);
        let listePoche = transPocheStockees ? JSON.parse(transPocheStockees) : [];
        if (!Array.isArray(listePoche)) listePoche = [];
        
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
      
      setDescription('');
      setMontant('');
      setType('depense');
      setCategorie('Alimentation');
      setModalVisible(false);
    } catch (e) {
      console.error("Erreur enregistrement transaction", e);
    }
  };

  const ajouterPrelevement = async () => {
    if (!nomPrelevement.trim() || !montantPrelevement.trim() || !jourPrelevement.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs du prélèvement.");
      return;
    }

    const valMontant = parseFloat(montantPrelevement);
    const valJour = parseInt(jourPrelevement, 10);

    if (isNaN(valMontant) || valMontant <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide.");
      return;
    }

    if (isNaN(valJour) || valJour < 1 || valJour > 31) {
      Alert.alert("Erreur", "Veuillez entrer un jour du mois valide (entre 1 et 31).");
      return;
    }

    const nouveauPrel = {
      id: Date.now().toString(),
      nom: nomPrelevement.trim(),
      montant: valMontant,
      jour: valJour,
      categorie: catPrelevement,
      dernierMoisApplique: null,
    };

    try {
      const nouvelleListePrel = [...prelevements, nouveauPrel];
      const clePrel = `@mon_budget_prelevements_${nomCompte}`;
      await AsyncStorage.setItem(clePrel, JSON.stringify(nouvelleListePrel));
      
      setPrelevements(nouvelleListePrel);
      setNomPrelevement('');
      setMontantPrelevement('');
      setJourPrelevement('');
      setCatPrelevement('Factures');
      setPrelevementModalVisible(false);

      Alert.alert("Succès", "Prélèvement récurrent configuré avec succès !");
    } catch (e) {
      console.error("Erreur ajout prélèvement", e);
    }
  };

  const supprimerPrelevement = (id: string) => {
    Alert.alert(
      "Supprimer le prélèvement",
      "Voulez-vous supprimer ce prélèvement automatique ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const nouvelleListe = prelevements.filter((p: any) => p.id !== id);
              const clePrel = `@mon_budget_prelevements_${nomCompte}`;
              await AsyncStorage.setItem(clePrel, JSON.stringify(nouvelleListe));
              setPrelevements(nouvelleListe);
            } catch (e) {
              console.error("Erreur suppression prélèvement", e);
            }
          }
        }
      ]
    );
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

      {/* Section des Prélèvements Récurrents */}
      <View style={styles.recurringSectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Prélèvements automatiques ({prelevements.length})</Text>
        <TouchableOpacity style={styles.addPrelButton} onPress={() => setPrelevementModalVisible(true)}>
          <Ionicons name="repeat" size={16} color="#fff" />
          <Text style={styles.addPrelButtonText}>Configurer</Text>
        </TouchableOpacity>
      </View>

      {prelevements.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prelevementsScroll}>
          {prelevements.map((p: any) => (
            <TouchableOpacity 
              key={p.id} 
              style={styles.prelChip}
              onLongPress={() => supprimerPrelevement(p.id)}
              delayLongPress={500}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color="#007AFF" style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.prelChipText}>{p.nom} : <Text style={{fontWeight: 'bold', color: '#e74c3c'}}>-{p.montant} €</Text></Text>
                <Text style={styles.prelChipSub}>Le {p.jour} du mois ({p.categorie})</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* En-tête de la liste des transactions & Bouton d'ajout */}
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

      {/* Modal d'ajout de transaction manuelle */}
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
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={ajouterTransaction}>
                  <Text style={styles.confirmButtonText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de configuration des prélèvements récurrents */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={prelevementModalVisible}
        onRequestClose={() => setPrelevementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nouveau Prélèvement Automatique</Text>

              <TextInput
                style={styles.input}
                placeholder="Nom du crédit ou abonnement (ex: Crédit Immo)"
                placeholderTextColor="#888"
                value={nomPrelevement}
                onChangeText={setNomPrelevement}
              />

              <TextInput
                style={styles.input}
                placeholder="Montant mensuel (€) (ex: 750)"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={montantPrelevement}
                onChangeText={setMontantPrelevement}
              />

              <TextInput
                style={styles.input}
                placeholder="Jour du mois du prélèvement (ex: 5 pour le 5)"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={jourPrelevement}
                onChangeText={setJourPrelevement}
              />

              <Text style={styles.labelCategorie}>Catégorie associée :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {categoriesDisponibles.map((cat) => (
                  <TouchableOpacity
                    key={'prel_' + cat.nom}
                    style={[styles.catChip, catPrelevement === cat.nom && styles.catChipSelected]}
                    onPress={() => setCatPrelevement(cat.nom)}
                  >
                    <MaterialCommunityIcons 
                      name={cat.icone} 
                      size={16} 
                      color={catPrelevement === cat.nom ? '#fff' : '#007AFF'} 
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.catChipText, catPrelevement === cat.nom && styles.catChipTextSelected]}>
                      {cat.nom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setPrelevementModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={ajouterPrelevement}>
                  <Text style={styles.confirmButtonText}>Enregistrer</Text>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, marginTop: 15 },
  backButton: { paddingVertical: 5 },
  backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  compteTitre: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  analyseButton: { padding: 5 },

  soldeCard: { alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  soldeLabel: { fontSize: 14, color: '#666' },
  soldeMontant: { fontSize: 32, fontWeight: 'bold', marginTop: 5 },

  recurringSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionHeaderTitle: { fontSize: 13, color: '#666', fontWeight: '600' },
  addPrelButton: { flexDirection: 'row', backgroundColor: '#8e44ad', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center' },
  addPrelButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },

  prelevementsScroll: { marginBottom: 12, maxHeight: 55 },
  prelChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#e8dff5', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 2 },
  prelChipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  prelChipSub: { fontSize: 11, color: '#888', marginTop: 1 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  listTitle: { fontSize: 13, color: '#666', fontWeight: '600' },
  addButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },

  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2 },
  transLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  transIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f2f6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transDescription: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 3 },
  transDetails: { fontSize: 12, color: '#888' },
  transMontant: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 20, fontSize: 14 },

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