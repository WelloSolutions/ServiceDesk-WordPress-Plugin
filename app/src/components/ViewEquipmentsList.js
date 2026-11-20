import React from 'react';
import { APP_BASENAME } from '../config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.js';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { setPrimaryTheme } from "../utils/setTheme";
import EquipmentTreeTable from './EquipmentTreeTable.js';

// SD-514: the equipments tree, filters and paging are in EquipmentTreeTable (shared with Create Ticket).
const ViewInstallations = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  setPrimaryTheme(auth?.colorPrimary);
  const { t } = useTranslation('equipmentList');

  return (
    <div className="min-w-[78%] w-full mx-auto p-1 md:p-8">
      <h1 className="text-primary text-3xl font-semibold mb-6">{t("equipments_list_page_title")}</h1>
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center mb-6 font-semibold text-zinc-900 text-base"
      >
        <ArrowLeft className="mr-2 w-5 h-5" /> {t("equipments_list_page_go_back")}
      </button>

      <EquipmentTreeTable
        helpText={t("equipments_list_page_helping_text")}
        onRowClick={(row) => window.open(`${window.location.origin}${APP_BASENAME}/equipment/${row.id}`, "_blank")}
      />
    </div>
  );
};

export default ViewInstallations;
