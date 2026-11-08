import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Switch, ScrollView } from 'react-native';
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
        // Liste vide par défaut pour une nouvelle installation propre
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
              const nouvelleListe = comptes.filter((c: any) => c.nom !== nomCompte);
              const comptesAStocker = nouvelleListe.map(({ solde, ...rest }: any) => rest);
              await AsyncStorage.setItem('@mon_budget_comptes', JSON.stringify(comptesAStocker));
              await AsyncStorage.removeItem(`@mon_budget_transactions_${nomCompte}`);
              setComptes(nouvelleListe);
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
      {/* En-tête avec Titre, Patrimoine Total, puis les boutons */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Comptes</Text>
        
        <View style={styles.patrimoineContainer}>
          <Text style={styles.patrimoineLabel}>Patrimoine total</Text>
          <Text style={[styles.patrimoineMontant, { color: patrimoineTotal >= 0 ? '#2ecc71' : '#e74c3c' }]}>
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
            <Text style={styles.actionButtonText}>Faire un virement</Text>
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

      <FlatList
        data={comptes}
        keyExtractor={(item: any) => item.nom}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity 
            style={styles.compteCard}
            onPress={() => router.push({ pathname: '/detail', params: { nomCompte: item.nom } })}
            onLongPress={() => supprimerCompte(item.nom)}
            delayLongPress={500}
          >
            <View style={styles.compteInfo}>
              <MaterialCommunityIcons name={item.icone || 'wallet'} size={28} color="#007AFF" />
              <View style={styles.compteTextContainer}>
                <Text style={styles.compteNom}>{item.nom}</Text>
                {item.arrondiActif && (
                  <Text style={styles.badgeArrondi}>Arrondis actifs (→ {item.pocheCible || 'Poche'})</Text>
                )}
              </View>
            </View>

            <View style={styles.compteRightContainer}>
              <Text style={[styles.compteSolde, { color: (item.solde || 0) >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                {(item.solde || 0).toFixed(2)} €
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" style={styles.chevron} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucun compte pour le moment. Créez-en un !</Text>
        }
      />

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
                placeholderTextColor="#888"
                value={nouveauCompte}
                onChangeText={setNouveauCompte}
              />

              <TextInput
                style={styles.input}
                placeholder="Solde initial (€) (ex: 150)"
                placeholderTextColor="#888"
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
                    <MaterialCommunityIcons name={ico} size={22} color={iconeSelectionnee === ico ? '#fff' : '#007AFF'} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Activer les arrondis</Text>
                  <Text style={styles.toggleSub}>Crée automatiquement une poche pour recevoir l'épargne</Text>
                </View>
                <Switch
                  value={arrondiActif}
                  onValueChange={setArrondiActif}
                  trackColor={{ false: "#ddd", true: "#007AFF" }}
                  thumbColor="#fff"
                />
              </View>

              {arrondiActif && (
                <View style={styles.pocheContainer}>
                  <Text style={styles.pocheSectionTitle}>Configuration de la Poche d'épargne</Text>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Nom de la poche (ex: Poche Vacances)"
                    placeholderTextColor="#888"
                    value={nomPoche}
                    onChangeText={setNomPoche}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Solde de départ de la poche (€) (ex: 0)"
                    placeholderTextColor="#888"
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
                        <MaterialCommunityIcons name={ico} size={22} color={iconePoche === ico ? '#fff' : '#2ecc71'} />
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
              placeholderTextColor="#888"
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
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  
  header: { marginBottom: 20, marginTop: 15 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  
  patrimoineContainer: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  patrimoineLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  patrimoineMontant: { fontSize: 26, fontWeight: 'bold', marginTop: 2 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { flex: 1, flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  virementButton: { backgroundColor: '#2ecc71', marginRight: 8 },
  nouveauButton: { backgroundColor: '#007AFF' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 6 },

  compteCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  compteInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  compteTextContainer: { marginLeft: 12, flex: 1 },
  compteNom: { fontSize: 16, fontWeight: '600', color: '#333' },
  badgeArrondi: { fontSize: 11, color: '#2ecc71', fontWeight: '500', marginTop: 2 },
  
  compteRightContainer: { alignItems: 'flex-end', marginLeft: 10 },
  compteSolde: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  chevron: { alignSelf: 'flex-end', marginTop: 2 },

  emptyText: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, maxHeight: '85%', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16, backgroundColor: '#fff' },

  labelIcone: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '600' },
  iconesScroll: { marginBottom: 12 },
  iconChip: { padding: 8, backgroundColor: '#f1f2f6', borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  iconChipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8 },
  toggleTextContainer: { flex: 1, marginRight: 10 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  toggleSub: { fontSize: 11, color: '#666', marginTop: 2 },

  pocheContainer: { backgroundColor: '#eef9f2', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#d4edda' },
  pocheSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#27ae60', marginBottom: 10 },

  labelCategorie: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  categoriesScroll: { marginBottom: 15 },
  catChip: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f1f2f6', borderRadius: 15, marginRight: 8, borderWidth: 1, borderColor: '#ddd' },
  catChipSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  catChipText: { color: '#333', fontSize: 13, fontWeight: '500' },
  catChipTextSelected: { color: '#fff', fontWeight: 'bold' },

  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f2f6', marginRight: 10 },
  cancelButtonText: { color: '#333', fontWeight: '600' },
  confirmButton: { backgroundColor: '#2ecc71', marginLeft: 10 },
  confirmButtonText: { color: '#fff', fontWeight: 'bold' },
});