import os

def finalize_accounts_workspace():
    path = r"c:\optiplan360_project\frontend\src\features\CRM\AccountsWorkspace.tsx"
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add Address Modal JSX
    # We'll append this before the closing fragment of the component
    address_modals_jsx = """
      <Modal 
        open={addressCreateOpen} 
        onClose={() => setAddressCreateOpen(false)} 
        title="Yeni Adres Ekle" 
        subtitle="Cari hesap için teslimat veya fatura adresi tanımlayın"
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedAccount) return;
          try {
            const created = await crmService.createAddress({ ...addressForm, account_id: selectedAccount.id });
            setAddresses(prev => [...prev, created]);
            setAddressCreateOpen(false);
            setAddressForm({ addressTitle: "", addressLine: "", city: "", district: "", isPrimary: false });
            notificationHelpers.success("Adres eklendi.");
          } catch (err) {
            notificationHelpers.error("Adres eklenemedi.");
          }
        }} style={{ display: "grid", gap: 16, padding: "10px 0" }}>
          <Input label="Adres Başlığı" value={addressForm.addressTitle} onChange={e => setAddressForm(p => ({...p, addressTitle: e.target.value}))} placeholder="Örn: Merkez, Depo, Şube" required />
          <Input label="Açık Adres" value={addressForm.addressLine} onChange={e => setAddressForm(p => ({...p, addressLine: e.target.value}))} placeholder="Sokak, No, Kat..." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="İl" value={addressForm.city} onChange={e => setAddressForm(p => ({...p, city: e.target.value}))} placeholder="İstanbul" />
            <Input label="İlçe" value={addressForm.district} onChange={e => setAddressForm(p => ({...p, district: e.target.value}))} placeholder="Ümraniye" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text }}>
            <input type="checkbox" checked={addressForm.isPrimary} onChange={e => setAddressForm(p => ({...p, isPrimary: e.target.checked}))} />
            Varsayılan adres olarak işaretle
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 10 }}>
            <Button type="button" variant="ghost" onClick={() => setAddressCreateOpen(false)}>İptal</Button>
            <Button type="submit" variant="primary">Ekle</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        open={addressEditOpen} 
        onClose={() => setAddressEditOpen(false)} 
        title="Adresi Düzenle" 
      >
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!editingAddress) return;
          try {
            const updated = await crmService.updateAddress(editingAddress.id, addressForm);
            setAddresses(prev => prev.map(a => a.id === updated.id ? updated : a));
            setAddressEditOpen(false);
            notificationHelpers.success("Adres güncellendi.");
          } catch (err) {
            notificationHelpers.error("Adres güncellenemedi.");
          }
        }} style={{ display: "grid", gap: 16, padding: "10px 0" }}>
          <Input label="Adres Başlığı" value={addressForm.addressTitle} onChange={e => setAddressForm(p => ({...p, addressTitle: e.target.value}))} required />
          <Input label="Açık Adres" value={addressForm.addressLine} onChange={e => setAddressForm(p => ({...p, addressLine: e.target.value}))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="İl" value={addressForm.city} onChange={e => setAddressForm(p => ({...p, city: e.target.value}))} />
            <Input label="İlçe" value={addressForm.district} onChange={e => setAddressForm(p => ({...p, district: e.target.value}))} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text }}>
            <input type="checkbox" checked={addressForm.isPrimary} onChange={e => setAddressForm(p => ({...p, isPrimary: e.target.checked}))} />
            Varsayılan adres
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 10 }}>
            <Button type="button" variant="ghost" onClick={() => setAddressEditOpen(false)}>İptal</Button>
            <Button type="submit" variant="primary">Güncelle</Button>
          </div>
        </form>
      </Modal>
"""
    # Insert before the last </div></>
    # Note: AccountsWorkspace ends with something like:
    #     </div>
    #   </>
    # );
    
    # We need to find the location before the last two closing tags.
    if '<Modal open={addressCreateOpen}' not in content:
        # Search for the end of the main div
        insertion_point = content.rfind("</div>")
        if insertion_point != -1:
             content = content[:insertion_point] + address_modals_jsx + content[insertion_point:]

    # 2. Add useEffect to populate addressForm when editingAddress changes
    edit_effect = """
  useEffect(() => {
    if (editingAddress) {
      setAddressForm({
        addressTitle: editingAddress.addressTitle || "",
        addressLine: editingAddress.addressLine || "",
        city: editingAddress.city || "",
        district: editingAddress.district || "",
        isPrimary: editingAddress.isPrimary || false
      });
    } else {
      setAddressForm({ addressTitle: "", addressLine: "", city: "", district: "", isPrimary: false });
    }
  }, [editingAddress]);
"""
    if 'useEffect(() => {\n    if (editingAddress)' not in content:
        # Insert after the last useEffect or after state declarations
        content = content.replace('const [addressForm, setAddressForm]', 'const [addressForm, setAddressForm] = useState({ addressTitle: "", addressLine: "", city: "", district: "", isPrimary: false });\n' + edit_effect)
        # Remove the previous duplicate declaration if any (the script might have added it)
        content = content.replace('useState({ addressTitle: "", addressLine: "", city: "", district: "", isPrimary: false });\n  const [addressForm, setAddressForm]', 'useState({ addressTitle: "", addressLine: "", city: "", district: "", isPrimary: false });')

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("AccountsWorkspace finalized with Address Modals.")

if __name__ == "__main__":
    finalize_accounts_workspace()
