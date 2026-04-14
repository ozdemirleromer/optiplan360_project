import React, { useState } from "react";
import { Modal } from "../../../components/Shared/Modal";
import { Icon } from "../../../components/Shared/Icon";

interface FaultyImageModalProps {
  onClose: () => void;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
}

export const FaultyImageModal: React.FC<FaultyImageModalProps> = ({ onClose, showToast }) => {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showToast("Lütfen neden belirtin", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showToast("Belge hatalı olarak işaretlendi", "success");
      onClose();
    } catch {
      showToast("İşlem sırasında hata oluştu", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onClose();
  };

  const reasonOptions = ["Okunamayan belge", "Eksik bilgi", "Yanlış belge türü", "Hasarlı belge", "Diğer"];

  return (
    <Modal open onClose={handleCancel} title="Hatalı Görsel" subtitle="Belgeyi süreçten çıkar" wide id="faulty-image-modal">
      <div className="bg-slate-700 rounded p-4 mb-6">
        <div className="flex items-center space-x-3">
          <Icon name="fileText" size="md" className="text-slate-400" aria-hidden={true} />
          <div>
            <p className="text-sm font-medium text-slate-200">Mevcut Belge</p>
            <p className="text-xs text-slate-400">siparis_formu_001.pdf</p>
          </div>
        </div>
      </div>

      <fieldset className="mb-6">
        <legend className="block text-sm font-medium text-slate-200 mb-3">Neden hatalı olduğunu açıklayın *</legend>
        <div className="space-y-2">
          {reasonOptions.map((option) => (
            <label key={option} htmlFor={`faulty-reason-${option}`} className="flex items-center space-x-3 cursor-pointer">
              <input
                id={`faulty-reason-${option}`}
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={(e) => setReason(e.target.value)}
                className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-slate-300">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-200 mb-3">Operatör Notları</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ek notlarınızı buraya yazın..."
          rows={4}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="bg-amber-900 border border-amber-700 rounded p-4 mb-6" role="note" aria-label="İşlem uyarısı">
        <div className="flex items-start space-x-3">
          <Icon name="warning" size="md" className="text-amber-300 mt-0.5" aria-hidden={true} />
          <div>
            <p className="text-sm font-medium text-amber-100">Uyarı</p>
            <p className="text-xs text-amber-200 mt-1">
              Bu işlem belgeyi OCR kontrol sürecinden çıkaracak ve farklı bir iş akışına yönlendirecektir.
              Bu işlem geri alınamaz.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-700 border-t border-slate-600 px-6 py-4 -mx-6 -mb-6 flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-slate-200 hover:bg-slate-500 transition-colors disabled:opacity-50"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !reason.trim()}
          className="px-4 py-2 bg-red-600 border border-red-500 rounded text-red-100 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isSubmitting && <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin"></div>}
          <span>Hatalı Olarak İşaretle</span>
        </button>
      </div>
    </Modal>
  );
};
