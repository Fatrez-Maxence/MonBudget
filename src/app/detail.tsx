import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, ScrollView, StatusBar } from 'react-native';
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

      // Vérification automatique des prélèvements récurrents
      const maintenant = new Date();
      const jourActuel = maintenant.getDate();
      const moisActuel = maintenant.getMonth();
      const anneeActuelle = maintenant.getFullYear();
      const dateFormatee = maintenant.toLocaleDateString('fr-FR');

      let desModifications = false;

      listePrel = listePrel.map((prel: any) => {
        if (jourActuel >= prel.jour) {
          const dernierAppel = prel.dernierMoisApplique ? new Date(prel.dernierMoisApplique) : null;
          const dejaFaitCeMois = dernierAppel && 
            dernierAppel.getMonth() === moisActuel && 
            dernierAppel.getFullYear() === anneeActuelle;

          if (!dejaFaitCeMois) {
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
          nomPocheCible = compteActuel.pocheCible || 'Poche Épargne';
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

    // --- CORRECTION ICI ---
    // On marque la date d'aujourd'hui comme "dernier mois appliqué" 
    // pour éviter un prélèvement rétroactif si le jour du mois est déjà passé.
    const maintenant = new Date();

    const nouveauPrel = {
      id: Date.now().toString(),
      nom: nomPrelevement.trim(),
      montant: valMontant,
      jour: valJour,
      categorie: catPrelevement,
      dernierMoisApplique: maintenant.toISOString(), // Empêche le prélèvement immédiat ce mois-ci
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

      Alert.alert("Succès", "Prélèvement récurrent configuré ! Il commencera à partir du mois prochain si la date est déjà passée.");
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* En-tête Neo-banque */}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.compteTitre}>{nomCompte}</Text>
          <TouchableOpacity style={styles.analyseButton} onPress={() => router.push({ pathname: '/analyse', params: { nomCompte } })}>
            <MaterialCommunityIcons name="chart-bar" size={22} color="#38bdf8" />
          </TouchableOpacity>
        </View>

        <View style={styles.soldeCard}>
          <Text style={styles.soldeLabel}>Solde actuel</Text>
          <Text style={[styles.soldeMontant, { color: solde >= 0 ? '#34d399' : '#f87171' }]}>
            {solde.toFixed(2)} €
          </Text>
        </View>

        {/* Section Prélèvements en-tête */}
        <View style={styles.recurringHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Prélèvements automatiques ({prelevements.length})</Text>
          <TouchableOpacity style={styles.addPrelButton} onPress={() => setPrelevementModalVisible(true)}>
            <Ionicons name="repeat" size={14} color="#fff" />
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
                <View style={styles.prelChipIcon}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#38bdf8" />
                </View>
                <View>
                  <Text style={styles.prelChipText}>{p.nom} : <Text style={{fontWeight: '700', color: '#f87171'}}>-{p.montant} €</Text></Text>
                  <Text style={styles.prelChipSub}>Le {p.jour} du mois</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Corps de la page : Liste des transactions */}
      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.listTitle}>Historique des transactions</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
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
                <View style={[styles.transIconContainer, { backgroundColor: item.montant >= 0 ? '#ecfdf5' : '#eff6ff' }]}>
                  <MaterialCommunityIcons 
                    name={getIconeCategorie(item.categorie)} 
                    size={20} 
                    color={item.montant >= 0 ? '#059669' : '#2563eb'} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transDescription} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.transDetails}>{item.categorie} • {item.date}</Text>
                </View>
              </View>
              <Text style={[styles.transMontant, { color: item.montant >= 0 ? '#059669' : '#ef4444' }]}>
                {item.montant > 0 ? `+${item.montant.toFixed(2)}` : item.montant.toFixed(2)} €
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="receipt" size={44} color="#cbd5e1" />
              <Text style={styles.emptyText}>Aucune transaction pour le moment.</Text>
            </View>
          }
        />
      </View>

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
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
              />

              <TextInput
                style={styles.input}
                placeholder="Montant (€)"
                placeholderTextColor="#94a3b8"
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
                          color={categorie === cat.nom ? '#fff' : '#2563eb'} 
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
                  <MaterialCommunityIcons name="cash-plus" size={20} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.revenuInfoText}>Catégorie automatique : <Text style={{ fontWeight: '700' }}>Revenu</Text></Text>
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
              <Text style={styles.modalTitle}>Nouveau Prélèvement</Text>

              <TextInput
                style={styles.input}
                placeholder="Nom (ex: Crédit Immo, Netflix)"
                placeholderTextColor="#94a3b8"
                value={nomPrelevement}
                onChangeText={setNomPrelevement}
              />

              <TextInput
                style={styles.input}
                placeholder="Montant mensuel (€) (ex: 750)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={montantPrelevement}
                onChangeText={setMontantPrelevement}
              />

              <TextInput
                style={styles.input}
                placeholder="Jour du mois (ex: 5 pour le 5)"
                placeholderTextColor="#94a3b8"
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
                      color={catPrelevement === cat.nom ? '#fff' : '#2563eb'} 
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  // En-tête style Néo-banque
  header: { 
    backgroundColor: '#0f172a', 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  compteTitre: { fontSize: 16, fontWeight: '700', color: '#fff' },
  analyseButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center' },

  soldeCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 16, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  soldeLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  soldeMontant: { fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },

  recurringHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionHeaderTitle: { fontSize: 12, color: '#94a3b8', fontWeight: '600', letterSpacing: 0.5 },
  addPrelButton: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  addPrelButtonText: { color: '#fff', fontWeight: '600', fontSize: 11, marginLeft: 4 },

  prelevementsScroll: { maxHeight: 52 },
  prelChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  prelChipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  prelChipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  prelChipSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // Corps de page
  listSection: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { fontSize: 15, fontWeight: '700', color: '#334155', letterSpacing: -0.2 },
  addButton: { flexDirection: 'row', backgroundColor: '#2563eb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 4 },

  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  transLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  transIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  transDescription: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  transDetails: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  transMontant: { fontSize: 15, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '500', marginTop: 10 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, maxHeight: '85%', padding: 22, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 18, textAlign: 'center', color: '#0f172a' },
  
  typeContainer: { flexDirection: 'row', marginBottom: 16, borderRadius: 12, backgroundColor: '#f1f5f9', padding: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  typeButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  typeButtonDepenseActive: { backgroundColor: '#ef4444' },
  typeButtonRevenuActive: { backgroundColor: '#10b981' },
  typeButtonText: { fontWeight: '600', color: '#64748b', fontSize: 13 },
  typeButtonTextActive: { color: '#fff' },

  input: { borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#f8fafc', color: '#0f172a' },
  labelCategorie: { fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: '600' },
  categoriesScroll: { marginBottom: 16 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f8fafc', borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  catChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  catChipText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  catChipTextSelected: { color: '#fff' },

  revenuInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#a7f3d0' },
  revenuInfoText: { fontSize: 13, color: '#059669' },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f5f9', marginRight: 8 },
  cancelButtonText: { color: '#475569', fontWeight: '600' },
  confirmButton: { backgroundColor: '#2563eb', marginLeft: 8 },
  confirmButtonText: { color: '#fff', fontWeight: '700' },
});