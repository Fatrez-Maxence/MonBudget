import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Switch, ScrollView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const [comptes, setComptes] = useState([]);
  const [patrimoineTotal, setPatrimoineTotal] = useState(0);
  
  // États pour le modal de création de compte
  const [modalVisible, setModalVisible] = useState(false);
  const [nouveauCompte, setNouveauCompte] = useState('');
  const [soldeInitial, setSoldeInitial] = useState('');
  const [arrondiActif, setArrondiActif] = useState(false);
  const [iconeSelectionnee, setIconeSelectionnee] = useState('wallet');
  const [nomPoche, setNomPoche] = useState('Poche Épargne');
  const [soldePocheInitial, setSoldePocheInitial] = useState('');
  const [iconePoche, setIconePoche] = useState('piggy-bank');

  // États pour le modal de virement
  const [virementModalVisible, setVirementModalVisible] = useState(false);
  const [compteSource, setCompteSource] = useState('');
  const [compteDestinataire, setCompteDestinataire] = useState('');
  const [montantVirement, setMontantVirement] = useState('');

  const iconesDisponibles = ['wallet', 'piggy-bank', 'credit-card', 'bank', 'cash-multiple', 'safe'];

  useFocusEffect(
    useCallback(() => {
      chargerComptesEtSoldes();
    }, [])
  );

  const chargerComptesEtSoldes = async () => {
    try {
      const data = await AsyncStorage.getItem('@mon_budget_comptes');
      let listeComptesBrute = [];

      if (data !== null) {
        const parsed = JSON.parse(data);
        listeComptesBrute = parsed.map((c: any) => 
          typeof c === 'string' 
            ? { nom: c, arrondiActif: false, icone: 'wallet', pocheCible: '' } 
            : { ...c, icone: c.icone || 'wallet' }
        );
      } else {
        listeComptesBrute = [];
      }

      let sommeTotale = 0;
      const comptesAvecSoldes = await Promise.all(
        listeComptesBrute.map(async (compte: any) => {
          const cleStorage = `@mon_budget_transactions_${compte.nom}`;
          const transData = await AsyncStorage.getItem(cleStorage);
          let soldeTotal = 0;
          if (transData) {
            const trans = JSON.parse(transData);
            if (Array.isArray(trans)) {
              soldeTotal = trans.reduce((acc, curr) => acc + curr.montant, 0);
            }
          }
          sommeTotale += soldeTotal;
          return { ...compte, solde: soldeTotal };
        })
      );

      setComptes(comptesAvecSoldes);
      setPatrimoineTotal(sommeTotale);
      
      if (comptesAvecSoldes.length >= 2) {
        if (!compteSource) setCompteSource(comptesAvecSoldes[0].nom);
        if (!compteDestinataire) setCompteDestinataire(comptesAvecSoldes[1].nom);
      }
    } catch (e) {
      console.error("Erreur chargement comptes et soldes", e);
    }
  };

  const ajouterCompte = async () => {
    if (!nouveauCompte.trim()) {
      Alert.alert("Erreur", "Veuillez entrer un nom pour le compte principal.");
      return;
    }

    const nomFormatte = nouveauCompte.trim();
    if (comptes.some((c: any) => c.nom.toLowerCase() === nomFormatte.toLowerCase())) {
      Alert.alert("Erreur", "Ce compte existe déjà.");
      return;
    }

    try {
      const nouvelleListeComptes = [...comptes];

      let nomPocheFormate = null;
      if (arrondiActif) {
        let baseNomPoche = nomPoche.trim() || `Poche de ${nomFormatte}`;
        nomPocheFormate = baseNomPoche;
        
        let compteur = 1;
        while (nouvelleListeComptes.some((c: any) => c.nom.toLowerCase() === nomPocheFormate.toLowerCase())) {
          nomPocheFormate = `${baseNomPoche} (${compteur})`;
          compteur++;
        }
      }

      const nouveauObjetCompte = {
        nom: nomFormatte,
        arrondiActif: arrondiActif,
        icone: iconeSelectionnee,
        pocheCible: nomPocheFormate,
      };
      nouvelleListeComptes.push(nouveauObjetCompte);

      const valSolde = parseFloat(soldeInitial);
      if (!isNaN(valSolde) && valSolde !== 0) {
        const transactionInitiale = {
          id: Date.now().toString(),
          description: "Solde initial",
          montant: valSolde,
          type: valSolde >= 0 ? "revenu" : "depense",
          categorie: "Autre",
          date: new Date().toLocaleDateString('fr-FR'),
        };
        await AsyncStorage.setItem(`@mon_budget_transactions_${nomFormatte}`, JSON.stringify([transactionInitiale]));
      } else {
        await AsyncStorage.setItem(`@mon_budget_transactions_${nomFormatte}`, JSON.stringify([]));
      }

      if (arrondiActif && nomPocheFormate) {
        const nouveauObjetPoche = {
          nom: nomPocheFormate,
          arrondiActif: false,
          icone: iconePoche,
        };
        nouvelleListeComptes.push(nouveauObjetPoche);

        const valSoldePoche = parseFloat(soldePocheInitial);
        const transPocheInitiale = [];
        if (!isNaN(valSoldePoche) && valSoldePoche !== 0) {
          transPocheInitiale.push({
            id: (Date.now() + 1).toString(),
            description: "Solde initial de la poche",
            montant: valSoldePoche,
            type: valSoldePoche >= 0 ? "revenu" : "depense",
            categorie: "Autre",
            date: new Date().toLocaleDateString('fr-FR'),
          });
        }
        await AsyncStorage.setItem(`@mon_budget_transactions_${nomPocheFormate}`, JSON.stringify(transPocheInitiale));
      }

      const comptesAStocker = nouvelleListeComptes.map(({ solde, ...rest }: any) => rest);
      await AsyncStorage.setItem('@mon_budget_comptes', JSON.stringify(comptesAStocker));
      
      setNouveauCompte('');
      setSoldeInitial('');
      setArrondiActif(false);
      setIconeSelectionnee('wallet');
      setNomPoche('Poche Épargne');
      setSoldePocheInitial('');
      setIconePoche('piggy-bank');
      setModalVisible(false);

      chargerComptesEtSoldes();
    } catch (e) {
      console.error("Erreur ajout compte et poche", e);
      Alert.alert("Erreur", "Une erreur est survenue lors de la création.");
    }
  };

  const effectuerVirement = async () => {
    if (!compteSource || !compteDestinataire || !montantVirement.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs du virement.");
      return;
    }

    if (compteSource === compteDestinataire) {
      Alert.alert("Erreur", "Le compte source et le compte destinataire doivent être différents.");
      return;
    }

    const montant = parseFloat(montantVirement);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert("Erreur", "Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    try {
      const dateDuJour = new Date().toLocaleDateString('fr-FR');
      const idBase = Date.now().toString();

      const cleSource = `@mon_budget_transactions_${compteSource}`;
      const dataSource = await AsyncStorage.getItem(cleSource);
      let listeSource = dataSource ? JSON.parse(dataSource) : [];
      if (!Array.isArray(listeSource)) listeSource = [];

      const transSource = {
        id: idBase + '_source',
        description: `Virement vers ${compteDestinataire}`,
        montant: -montant,
        type: 'depense',
        categorie: 'Virement',
        date: dateDuJour,
      };
      listeSource.unshift(transSource);
      await AsyncStorage.setItem(cleSource, JSON.stringify(listeSource));

      const cleDest = `@mon_budget_transactions_${compteDestinataire}`;
      const dataDest = await AsyncStorage.getItem(cleDest);
      let listeDest = dataDest ? JSON.parse(dataDest) : [];
      if (!Array.isArray(listeDest)) listeDest = [];

      const transDest = {
        id: idBase + '_dest',
        description: `Virement depuis ${compteSource}`,
        montant: montant,
        type: 'revenu',
        categorie: 'Virement',
        date: dateDuJour,
      };
      listeDest.unshift(transDest);
      await AsyncStorage.setItem(cleDest, JSON.stringify(listeDest));

      setMontantVirement('');
      setVirementModalVisible(false);
      chargerComptesEtSoldes();

      Alert.alert("Succès", `Virement de ${montant.toFixed(2)} € effectué avec succès !`);
    } catch (e) {
      console.error("Erreur lors du virement", e);
      Alert.alert("Erreur", "Impossible d'effectuer le virement.");
    }
  };

const supprimerCompte = (nomCompte: string) => {
    Alert.alert(
      "Supprimer le compte",
      `Voulez-vous supprimer le compte "${nomCompte}" et toutes ses transactions ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. On filtre la liste pour retirer le compte supprimé
              const nouvelleListe = comptes.filter((c: any) => c.nom !== nomCompte);
              
              // 2. On met à jour le stockage des comptes
              const comptesAStocker = nouvelleListe.map(({ solde, ...rest }: any) => rest);
              await AsyncStorage.setItem('@mon_budget_comptes', JSON.stringify(comptesAStocker));
              
              // 3. On supprime les transactions liées à ce compte
              await AsyncStorage.removeItem(`@mon_budget_transactions_${nomCompte}`);
              
              // 4. --- CORRECTION : On recalcule immédiatement le patrimoine total ---
              const nouveauPatrimoine = nouvelleListe.reduce((acc, curr: any) => acc + (curr.solde || 0), 0);
              
              // 5. On met à jour les états de l'écran
              setComptes(nouvelleListe);
              setPatrimoineTotal(nouveauPatrimoine);
            } catch (e) {
              console.error("Erreur suppression compte", e);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* En-tête type Néo-banque */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.appSubtitle}>SYNTHÈSE FINANCIÈRE</Text>
          <TouchableOpacity style={styles.profileIconContainer}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#38bdf8" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.patrimoineCard}>
          <Text style={styles.patrimoineLabel}>Patrimoine total</Text>
          <Text style={[styles.patrimoineMontant, { color: patrimoineTotal >= 0 ? '#34d399' : '#f87171' }]}>
            {patrimoineTotal.toFixed(2)} €
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.virementButton]} 
            onPress={() => {
              if (comptes.length < 2) {
                Alert.alert("Information", "Vous devez avoir au moins 2 comptes pour effectuer un virement.");
                return;
              }
              setVirementModalVisible(true);
            }}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Virement</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.nouveauButton]} 
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Nouveau compte</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Mes Comptes & Pockets</Text>
        
        <FlatList
          data={comptes}
          keyExtractor={(item: any) => item.nom}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity 
              style={styles.compteCard}
              onPress={() => router.push({ pathname: '/detail', params: { nomCompte: item.nom } })}
              onLongPress={() => supprimerCompte(item.nom)}
              delayLongPress={500}
            >
              <View style={styles.compteInfo}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name={item.icone || 'wallet'} size={22} color="#2563eb" />
                </View>
                <View style={styles.compteTextContainer}>
                  <Text style={styles.compteNom}>{item.nom}</Text>
                  {item.arrondiActif && (
                    <View style={styles.badgeContainer}>
                      <MaterialCommunityIcons name="piggy-bank" size={12} color="#059669" style={{ marginRight: 3 }} />
                      <Text style={styles.badgeArrondi}>Arrondis actifs</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.compteRightContainer}>
                <Text style={[styles.compteSolde, { color: (item.solde || 0) >= 0 ? '#0f172a' : '#ef4444' }]}>
                  {(item.solde || 0).toFixed(2)} €
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Aucun compte pour le moment.</Text>
              <Text style={styles.emptySubText}>Appuyez sur "Nouveau compte" pour commencer.</Text>
            </View>
          }
        />
      </View>

      {/* Modal de création de compte */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Créer un compte</Text>

              <TextInput
                style={styles.input}
                placeholder="Nom du compte principal (ex: Compte Courant)"
                placeholderTextColor="#94a3b8"
                value={nouveauCompte}
                onChangeText={setNouveauCompte}
              />

              <TextInput
                style={styles.input}
                placeholder="Solde initial (€) (ex: 150)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={soldeInitial}
                onChangeText={setSoldeInitial}
              />

              <Text style={styles.labelIcone}>Icône du compte :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconesScroll}>
                {iconesDisponibles.map((ico) => (
                  <TouchableOpacity
                    key={ico}
                    style={[styles.iconChip, iconeSelectionnee === ico && styles.iconChipSelected]}
                    onPress={() => setIconeSelectionnee(ico)}
                  >
                    <MaterialCommunityIcons name={ico} size={22} color={iconeSelectionnee === ico ? '#fff' : '#2563eb'} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Activer les arrondis</Text>
                  <Text style={styles.toggleSub}>Alimente une poche d'épargne automatiquement</Text>
                </View>
                <Switch
                  value={arrondiActif}
                  onValueChange={setArrondiActif}
                  trackColor={{ false: "#cbd5e1", true: "#2563eb" }}
                  thumbColor="#fff"
                />
              </View>

              {arrondiActif && (
                <View style={styles.pocheContainer}>
                  <Text style={styles.pocheSectionTitle}>Poche d'épargne associée</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Nom de la poche (ex: Poche Vacances)"
                    placeholderTextColor="#94a3b8"
                    value={nomPoche}
                    onChangeText={setNomPoche}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Solde de départ de la poche (€) (ex: 0)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={soldePocheInitial}
                    onChangeText={setSoldePocheInitial}
                  />

                  <Text style={styles.labelIcone}>Icône de la poche :</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconesScroll}>
                    {iconesDisponibles.map((ico) => (
                      <TouchableOpacity
                        key={'poche_' + ico}
                        style={[styles.iconChip, iconePoche === ico && styles.iconChipSelected]}
                        onPress={() => setIconePoche(ico)}
                      >
                        <MaterialCommunityIcons name={ico} size={22} color={iconePoche === ico ? '#fff' : '#059669'} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={ajouterCompte}>
                  <Text style={styles.confirmButtonText}>Créer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de virement entre comptes */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={virementModalVisible}
        onRequestClose={() => setVirementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Effectuer un virement</Text>

            <Text style={styles.labelCategorie}>Compte source (débit) :</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {comptes.map((c: any) => (
                <TouchableOpacity
                  key={'src_' + c.nom}
                  style={[styles.catChip, compteSource === c.nom && styles.catChipSelected]}
                  onPress={() => setCompteSource(c.nom)}
                >
                  <Text style={[styles.catChipText, compteSource === c.nom && styles.catChipTextSelected]}>{c.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.labelCategorie}>Compte destinataire (crédit) :</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {comptes.map((c: any) => (
                <TouchableOpacity
                  key={'dest_' + c.nom}
                  style={[styles.catChip, compteDestinataire === c.nom && styles.catChipSelected]}
                  onPress={() => setCompteDestinataire(c.nom)}
                >
                  <Text style={[styles.catChipText, compteDestinataire === c.nom && styles.catChipTextSelected]}>{c.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="Montant du virement (€)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={montantVirement}
              onChangeText={setMontantVirement}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setVirementModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={effectuerVirement}
              >
                <Text style={styles.confirmButtonText}>Transférer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  // En-tête premium style néo-banque
  header: { 
    backgroundColor: '#0f172a', 
    paddingHorizontal: 20, 
    paddingTop: 15, 
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  appSubtitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.2 },
  profileIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center' },

  patrimoineCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  patrimoineLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  patrimoineMontant: { fontSize: 30, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  virementButton: { backgroundColor: '#1e293b', marginRight: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  nouveauButton: { backgroundColor: '#2563eb' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 6 },

  // Section liste
  listSection: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginBottom: 12, letterSpacing: -0.2 },

  compteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#64748b', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  compteInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  compteTextContainer: { marginLeft: 12, flex: 1 },
  compteNom: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  
  badgeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  badgeArrondi: { fontSize: 11, color: '#059669', fontWeight: '600' },
  
  compteRightContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  compteSolde: { fontSize: 16, fontWeight: '700', marginRight: 6 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { textAlign: 'center', color: '#475569', fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySubText: { textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 4 },

  // Modals & Forms
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, maxHeight: '85%', padding: 22, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 18, textAlign: 'center', color: '#0f172a' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#f8fafc', color: '#0f172a' },

  labelIcone: { fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: '600' },
  iconesScroll: { marginBottom: 14 },
  iconChip: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f8fafc', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  iconChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  toggleTextContainer: { flex: 1, marginRight: 10 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  toggleSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  pocheContainer: { backgroundColor: '#ecfdf5', padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: '#a7f3d0' },
  pocheSectionTitle: { fontSize: 13, fontWeight: '700', color: '#059669', marginBottom: 10 },

  labelCategorie: { fontSize: 13, color: '#475569', marginBottom: 8, fontWeight: '600' },
  categoriesScroll: { marginBottom: 16 },
  catChip: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#f8fafc', borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  catChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  catChipText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  catChipTextSelected: { color: '#fff' },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  modalButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f5f9', marginRight: 8 },
  cancelButtonText: { color: '#475569', fontWeight: '600' },
  confirmButton: { backgroundColor: '#2563eb', marginLeft: 8 },
  confirmButtonText: { color: '#fff', fontWeight: '700' },
});