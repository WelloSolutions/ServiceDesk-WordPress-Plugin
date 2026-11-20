import React, { useMemo, useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { fetchDocuments } from '../services/apiServiceDocuments';
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  XCircle, X, CircleCheckBig, FileText, Clock, File, Circle, Wrench,
  MapPin, UploadCloud, ChevronDown, ChevronUp, Check, TicketX, Thermometer, Loader2
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import { useTranslation } from "react-i18next";
import { setPrimaryTheme } from "../utils/setTheme";
import EquipmentTreeTable from './EquipmentTreeTable.js';

import Select from 'react-select';
import makeAnimated from 'react-select/animated';
const animatedComponents = makeAnimated();

const CreateTicket = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  setPrimaryTheme(auth?.colorPrimary);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  // id of the equipment whose details are being loaded after a click in the equipments table
  const [selectingId, setSelectingId] = useState(null);
  const [step, setStep] = useState(0);
  const [ticketDetails, setTicketDetails] = useState({
    ticketType: '',
    severity: '',
    problemDescription: '',
    file: [] // ensure file is an array to avoid files.map is not a function
  });

  const [ticketTypes, setTicketTypes] = useState([]);
  const [severities, setSeverities] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [severitiesLoaded, setSeveritiesLoaded] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);


  const [ticketName, setTicketName] = useState('');
  const [textarea, setTextarea] = useState('');

  const [userID, setUserID] = useState();

  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const maxFileSize = 5 * 1024 * 1024;

  const [date, setDate] = React.useState(new Date());
  //const [selectedTime, setSelectedTime] = useState(null);
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();

    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  });
  const [isOpen, setIsOpen] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [responseId, setResponseId] = useState();
  const dropdownRef = useRef(null);
  const { t, i18n } = useTranslation('createTicket');
  const locale = i18n?.language || 'en-GB'; // used for Calendar and toLocaleString

  const baseUrl = API_BASE_URL;

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30',
    '18:00'
  ];

  const steps = [
    { id: 0, label: t("create_ticket_page_step_1") },
    { id: 1, label: t("create_ticket_page_step_2") },
    { id: 2, label: t("create_ticket_page_step_3") },
    { id: 3, label: t("create_ticket_page_step_4") },
  ];

  const severityType = useMemo(() => ({
    "Not urgent": "text-blue-800 ",
    "Urgent": "text-red-800 ",
  }), []);

  const syncTicketFiles = (updatedFiles) => {
    setTicketDetails((prevDetails) => ({
      ...prevDetails,
      file: updatedFiles,
    }));
  };


  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files || []);

    // Filter out large files and warn
    const validFiles = newFiles.filter((file) => {
      if (file.size > maxFileSize) {
        toast.warn(t("create_ticket_file_more_then_max_size", { fileName: file.name }));
        return false;
      }
      return true;
    });

    setFiles((prevFiles) => {
      const uniqueFiles = validFiles.filter((f) => {
        const isDuplicate = prevFiles.some(
          (pf) =>
            pf.name === f.name &&
            pf.size === f.size &&
            pf.lastModified === f.lastModified
        );

        if (isDuplicate) {
          toast.warn(t("create_ticket_fileAlreadyAdded", { fileName: f.name }));
          return false;
        }
        return true;
      });

      const updatedFiles = [...prevFiles, ...uniqueFiles];

      // optional sync
      syncTicketFiles?.(updatedFiles);

      return updatedFiles;
    });

    // Clear input so user can select same files again
    if (fileInputRef?.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((file) => file.name !== index.name);
      syncTicketFiles(updatedFiles);
      return updatedFiles;
    });
  };

  const ticketTypeOptions = useMemo(() => ticketTypes.map((type) => ({
    value: type.name,
    label: type.name,
  })), [ticketTypes]);

  const severityOptions = useMemo(() => severities.map((severity) => ({
    value: severity.name,
    label: severity.name,
  })), [severities]);


  const handleInputChange = (key, value) => {
    if (key === 'problemDescription') {
      setTextarea(value);
    }
    setTicketDetails((prev) => ({
      ...prev,
      [key]: value,
    }));
  };


  // Batch API calls for ticket types, priorities, and user ID
  useEffect(() => {
    const loadTicketMetadata = async () => {
      if (typesLoaded && severitiesLoaded && userLoaded) return;

      try {
        const promises = [];

        // Only fetch if not already loaded
        if (!typesLoaded && step === 1) promises.push(fetchDocuments('api/TaskType?$orderby=is_default,sequence', 'GET', auth.authKey));
        else promises.push(Promise.resolve(null));

        if (!severitiesLoaded && step === 1) promises.push(fetchDocuments('api/TaskPriority?$orderby=is_default,sequence', 'GET', auth.authKey));
        else promises.push(Promise.resolve(null));

        if (!userLoaded && step === 1) promises.push(fetchDocuments(`api/Contact?$filter=e_login+eq+'${encodeURIComponent(auth.authEmail)}'`, 'GET', auth.authKey));
        else promises.push(Promise.resolve(null));

        const [typeRes, severityRes, userRes] = await Promise.all(promises);

        if (typeRes) {
          setTicketTypes(typeRes.value);
          setTypesLoaded(true);
        }
        if (severityRes) {
          setSeverities(severityRes.value);
          setSeveritiesLoaded(true);
        }
        if (userRes) {
          setUserID(userRes.value[0]);
          setUserLoaded(true);
        }
      } catch (err) {
        console.error('Error loading ticket metadata:', err);
        setError(err);
      }
    };

    loadTicketMetadata();
  }, [auth, typesLoaded, severitiesLoaded, userLoaded, step]);

  const handleNameChange = (e) => {
    setTicketName(e.target.value);
  };

  // The equipments table returns the columns it shows; the ticket needs more (company_id, id2, db_address...):
  // load the equipment like the equipment page does (api/ProjectView(id)).
  const handleRowClick = async (row) => {
    if (selectingId) return;
    setSelectingId(row.id);
    try {
      const equipment = await fetchDocuments(`api/ProjectView(${row.id})`, 'GET', auth.authKey);
      if (!equipment?.id) throw new Error('Equipment not found');
      setSelectedRow(equipment);
      setStep(1);
    } catch (err) {
      console.error('Failed to load the equipment', err);
      toast.error(t('create_ticket_failed_load_equipment'));
    } finally {
      setSelectingId(null);
    }
  };

  // if (loading) {
  //   return <div className="flex w-full items-center justify-center h-screen">
  //     <div className="relative">
  //       <div className="w-20 h-20 border-purple-200 border-2 rounded-full"></div>
  //       <div className="w-20 h-20 border-purple-700 border-t-2 animate-spin rounded-full absolute left-0 top-0"></div>
  //     </div>
  //   </div>;
  // }

  if (error) {
    return <div className="text-center text-red-600">Error fetching data: {error.message}</div>;
  }

  function getFormattedDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000`;
  }

  const handleSubmitTicket = async () => {
    setSubmitLoading(true); // ⬅️ Start loading

    const selectedTaskType = ticketTypes.find(type => type.name === ticketDetails.ticketType); // Assuming you're choosing from a list
    const selectedSeverity = severities.find(severity => severity.name === ticketDetails.severity); // Assuming you're choosing from a list

    const payloadData = {
      "contact_id": userID.id,
      "company_id": selectedRow.company_id,
      "db_address_id": selectedRow.db_address_id,
      "to_db_table_id": "78154eca-ded3-490f-a47d-543e38c0e63d",
      "to_id_in_table": selectedRow.id,
      "task_type_id": selectedTaskType.id,
      "task_priority_id": selectedSeverity.id,
      "subject": ticketName,
      "remark": ticketDetails.problemDescription,
      "date_suggested_by_company": `${date.toDateString()} ${selectedTime}`,
      "date_closed": "1980-01-01",
      "date_update": "1980-01-01",
      "date_start": getFormattedDate(),
      "date_create": getFormattedDate()
    };

    try {
      const response = await fetchDocuments('api/Task', 'POST', auth.authKey, payloadData);

      if (response) {
        await postImage(response.id, response.id2);
        toast.success(t('create_ticket_created_successfully'));
        setIsSubmitModalOpen(true);
        setResponseId(response.id);
        //navigate(`/ticket/${response.id}`)
      }

      // Reset state after submission
      setStep(3);

    } catch (err) {
      console.error('Error creating ticket:', err);
      setError(err);
      toast.error(t('create_ticket_failed_create_ticket'));
    } finally {
      setSubmitLoading(false);      // ⬅️ Stop loading
    }
  };

  const postImage = async (ticketId, ticketId2) => {
    try {
      if (!ticketId || !ticketId2) {
        throw new Error(t("create_ticket_error_missing_identifiers"));
      }

      const selectedFiles = ticketDetails?.file;
      if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
        return; // nothing to upload
      }

      const headers = {};
      if (auth?.authKey) {
        headers["Authorization"] = `Basic ${auth.authKey}`;
      }

      // ✅ Upload each file in its own request
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const description = `Uploaded by Service Desk - ${ticketId2}`;
        formData.append("description", description);

        const endpoint = `/api/dbfile/add?db_table_id=448260E5-7A17-4381-A254-0B1D8FE53947&id_in_table=${ticketId}&description=${encodeURIComponent(
          description
        )}`;

        const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: formData,
        });

        let json = null;
        try {
          json = await res.json();
        } catch {
          const text = await res.text();
          console.warn("Non-JSON response:", text);
        }

        if (!res.ok || (json && json.success === false)) {
          throw new Error(json?.message || `Upload failed for file: ${file.name}`);
        }

        console.log(`Upload successful for ${file.name}:`, json);
      }

      //toast.success("All files uploaded successfully.");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(t('create_ticket_failed_upload_files.'));
    }
  };



  // Handle image drop 
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragActive(false);

    // Use the same handler as file input so files stay as File objects (array)
    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    if (droppedFiles.length === 0) return;
    // Re-use existing handler which validates sizes and updates state
    handleFileChange({ target: { files: droppedFiles } });
  };

  // allow drop event
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  // for stop dragging state
  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  return (
    <div className="min-w-[78%] w-full p-1 md:p-8">
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      <h1 className="justify-start text-primary text-3xl font-semibold mb-6">{t("create_ticket_page_title")}</h1>

      {/* Step Indicator Bar */}
      <div className='w-full border-b-2 mb-4 border-gray-200'>
        <div className="mx-auto w-10/12 md:w-9/12 relative mb-16 mx-4">
          {/* Progress Line Background */}
          <div className="absolute w-full top-5 h-1 bg-gray-300 z-0" />

          {/* Progress Line Fill */}
          <div
            className="absolute top-5 w-full h-1 bg-lime-400 z-10 transition-all duration-300"
            style={{
              width: `${((step / 3) * 100).toFixed(2)}%`,
            }}
          ></div>

          {/* Steps */}
          <div className="flex justify-between w-full gap-0 relative z-20">
            {steps.map((item) => (
              <div key={item.id} className="text-center">
                {/* Step Circle */}
                <div
                  className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center relative z-10 ${step > item.id
                    ? "bg-lime-400 text-white"
                    : step === item.id
                      ? "bg-lime-400 text-white shadow-lg"
                      : "bg-gray-200 text-gray-300"
                    }`}
                >
                  {step > item.id
                    ? <Check className='w-6 h-6' />
                    : <Circle className='w-4 h-4 bg-white rounded-full text-white' />
                  }
                  <p className='text-base md:text-md mt-2 text-slate-700 font-medium absolute top-12 md:w-max'>
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* <button
        onClick={() => navigate('/')} // Navigate back one step in history
        className="flex items-center mb-6 font-semibold text-zinc-900 text-base"
      >
        <ArrowLeft className="mr-2 w-5 h-5" /> {t("create_ticket_page_go_back")}
      </button> */}

      {/* Step 1: kept mounted (hidden) on the next steps, so going back keeps the filters, page and expanded rows */}
      <div className={step === 0 ? '' : 'hidden'}>
        <EquipmentTreeTable
          title={t("create_ticket_step-1_title")}
          helpText={t("create_ticket_step-1_helping_text")}
          onRowClick={handleRowClick}
        />
        {selectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" aria-label="Loading" />
          </div>
        )}
      </div>

      {step === 1 && (
        <div className="w-full max-w-3xl mx-auto">
          <h2 className="text-zinc-900 text-xl font-semibold mb-6">{t("create_ticket_step-2_title")}</h2>
          <p className='mb-2 text-gray-400 text-base font-medium leading-tight'>{t("create_ticket_step-2_subtitle")}</p>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-2_address")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">

                <li className='flex items-center'>
                  <span className="w-8 flex">
                    <MapPin className='w-4 h-4' />
                  </span>
                  <span className="flex-1">{selectedRow.db_address_street}</span>
                </li>
                <li className='ml-8 pb-1'>{selectedRow.db_address} {selectedRow.db_address_zip}</li>
              </ul>
            </div>

            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-2_equipment")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li className="flex items-center">
                  <span className="w-8 flex">
                    <Wrench className="w-4 h-4" />
                  </span>
                  <span className="flex-1">{selectedRow.name}</span>
                </li>
                <li className='ml-8 pb-1'>{selectedRow.equipment_family_name}</li>
                <li className='ml-8 pb-1'>{selectedRow.equipment_brand_name}</li>
                <li className='ml-8 pb-1'>{selectedRow.equipment_model_name}</li>
              </ul>
            </div>

            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-2_properties")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li className='grid grid-cols-2 gap-2 items-start'>{t("create_ticket_step-2_barcode")}: <span className='font-semibold break-words'>{selectedRow.barcode || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-2 items-end'>{t("create_ticket_step-2_serial_number")}: <span className='font-semibold break-all'>{selectedRow.serial_number || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-2 items-start'>{t("create_ticket_step-2_our_ref")}: <span className='font-semibold break-all'>{selectedRow.customer_reference || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-2 items-start'>{t("create_ticket_step-2_supplier_ref")}: <span className='font-semibold break-all'>{selectedRow.id2 || 'NA'}</span></li>
              </ul>
            </div>
          </div>
          <div className='w-full w-full mx-auto'>
            <hr className=' my-12 border-b-1 border-gray-200' />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const wordCount = ticketName
                .trim()
                .split(/\s+/)
                .filter(word => word.length >= 3)
                .length;
              if (wordCount) {
                setStep(2);
              }
            }}
          >
            <div className="mb-8">
              <div className="flex flex-row gap-2 md:gap-8">
                <div className="relative basis-1/2">
                  <TicketX className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <Select
                    required
                    isSearchable={false}
                    closeMenuOnSelect={true}
                    components={animatedComponents}
                    options={ticketTypeOptions}
                    isClearable={true}
                    value={
                      ticketDetails.ticketType
                        ? ticketTypeOptions.find(opt => opt.value === ticketDetails.ticketType)
                        : null
                    }
                    onChange={(selectedOption) =>
                      handleInputChange(
                        'ticketType',
                        selectedOption ? selectedOption.value : ''
                      )
                    }
                    placeholder={t('create_ticket_step-2_select_ticket_type')}
                    className="w-full pl-10 py-1 text-gray-500 text-base font-normal leading-normal border rounded-md"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        border: 'rgb(var(--color-primary) / 1)',
                        boxShadow: 'rgb(var(--color-primary) / 1)',
                      }),
                      option: (base, state) => ({
                        ...base,
                        whiteSpace: "nowrap", // prevent wrapping
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: state.isSelected
                          ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
                          : state.isFocused
                            ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
                            : 'rgb(var(--color-primary) / var(--tw-bg-opacity, 1))',
                        backgroundColor: state.isSelected
                          ? 'rgb(var(--color-primary) / 0.7)'
                          : state.isFocused
                            ? 'rgb(var(--color-primary) / 0.5)'
                            : 'transparent',
                        cursor: 'pointer',
                      }),
                      menu: (provided) => ({
                        ...provided,
                        width: '85%', // controls dropdown menu width
                      }),
                    }}
                  />
                </div>

                <div className="relative basis-1/2">
                  <Thermometer className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <Select
                    required
                    isSearchable={false}
                    closeMenuOnSelect={true}
                    components={animatedComponents}
                    options={severityOptions}
                    isClearable={true}
                    value={
                      ticketDetails.severity
                        ? severityOptions.find((opt) => opt.value === ticketDetails.severity)
                        : null
                    }
                    onChange={(severityOptions) =>
                      handleInputChange('severity', severityOptions ? severityOptions.value : '')
                    }
                    placeholder={t('create_ticket_step-2_select_severity')}
                    className="w-full pl-10 py-1 text-gray-500 text-base font-normal leading-normal border rounded-md"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        border: 'rgb(var(--color-primary) / 1)',
                        boxShadow: 'rgb(var(--color-primary) / 1)',
                      }),
                      option: (base, state) => ({
                        ...base,
                        whiteSpace: "nowrap", // prevent wrapping
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: state.isSelected
                          ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
                          : state.isFocused
                            ? 'rgb(var(--color-primary-foreground) / var(--tw-bg-opacity, 1))'
                            : 'rgb(var(--color-primary) / var(--tw-bg-opacity, 1))',
                        backgroundColor: state.isSelected
                          ? 'rgb(var(--color-primary) / 0.7)'
                          : state.isFocused
                            ? 'rgb(var(--color-primary) / 0.5)'
                            : 'transparent',
                        cursor: 'pointer',
                      }),
                      menu: (provided) => ({
                        ...provided,
                        width: '85%', // controls dropdown menu width
                      }),
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-slate-700 text-base font-medium leading-tight"><span className='text-red-500'>* </span>{t("create_ticket_step-2_issue_inputbox_label")}</label>
              <input
                type="text"
                minLength={3}
                maxLength={50}
                value={ticketName}
                onChange={handleNameChange}
                required
                placeholder={t('create_ticket_step-2_issue_inputbox_placeholder')}
                className="mt-1 p-2 text-gray-800 font-normal leading-normal text-base w-full border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-red-500 text-base font-normal leading-normal mt-1 text-end">
                {50 - ticketName.length} {t("create_ticket_step-2_characters_remaining_text")}
              </p>
            </div>

            <div className="mb-4">
              <textarea
                minLength={5}
                maxLength={255}
                value={textarea}
                required
                onChange={(e) => handleInputChange('problemDescription', e.target.value)}
                placeholder={t('create_ticket_step-2_description_textbox_placeholder')}
                className="mt-1 p-2 h-32 text-gray-800 font-normal leading-normal text-base w-full border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-red-500 text-base font-normal leading-normal mt-1 text-end">
                {255 - textarea.length} {t("create_ticket_step-2_characters_remaining_text")}
              </p>
            </div>

            {/* File Upload Field */}
            <div className="w-full mx-auto">
              <label
                htmlFor="file-upload"
                tabIndex={0}
                className={`flex flex-col items-center justify-center w-full px-4 pt-1 transition bg-white border border-gray-300 rounded-md cursor-pointer ${isDragActive ? "bg-primary/10 border-primary" : ""
                  }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-8 h-8 mb-3 p-1.5 rounded-3xl text-zinc-800 bg-lime-300 outline outline-8 outline-lime-200/50" />
                  <p className="mb-2 text-zinc-800 text-base leading-tight text-center">
                    <span className="font-medium">
                      {t("create_ticket_step-2_upload_inputfile_label_1")}
                    </span>
                    <span className="font-normal text-gray-500">
                      {t("create_ticket_step-2_upload_inputfile_label_2")}
                    </span>
                  </p>
                  <p className="text-gray-500 text-base font-normal leading-none">
                    {t("create_ticket_step-2_upload_inputfile_name")}
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>


            <div className="mb-4">
              {/* File Thumbnails Grid */}
              {files.length > 0 && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 border border-gray-300 rounded-md p-4 mt-4">
                  {files.map((file, index) => {
                    const fileURL = URL.createObjectURL(file);
                    const isImage = file.type.startsWith("image/");
                    const isPDF = file.type === "application/pdf";

                    return (
                      <div key={index} className="relative group h-auto">
                        {/* Thumbnail */}
                        {isImage ? (
                          <div>
                            <img
                              src={fileURL}
                              alt="Preview"
                              className="w-36 h-36 object-cover rounded-md overflow-hidden"
                              onLoad={() => URL.revokeObjectURL(fileURL)} // ✅ revoke after load
                            />
                            <p className="mt-2 text-base break-words whitespace-normal text-gray-800">{file.name}</p>
                          </div>
                        ) : (
                          <div>
                            {isPDF ? (
                              <FileText className="w-36 h-36 text-gray-600" />
                            ) : (
                              <File className="w-36 h-36 text-gray-600" />
                            )}
                            <p className="mt-2 text-base break-words whitespace-normal text-gray-800">{file.name}</p>
                          </div>
                        )}

                        {/* Remove Icon */}
                        <button
                          type='button'
                          onClick={() => removeFile(file)}
                          className="absolute top-1 right-1 bg-primary-foreground rounded-full opacity-80 hover:opacity-100 transition-opacity shadow-md"
                        >
                          <XCircle className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button type='button' onClick={() => setStep(0)} className="w-40 px-5 py-2 border border-2 border-primary bg-primary-foreground rounded-lg flex items-center justify-center text-primary text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {t('create_ticket_popup_button_back')}
              </button>
              <button type="submit" className="w-40 px-5 py-2 ml-2 border border-2 border-primary bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {t('create_ticket_popup_button_next')}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 p-2 md:p-6 w-full max-w-2xl mx-auto">
          <h2 className="text-zinc-900 text-xl font-semibold mb-4">{t("create_ticket_page_step-3_title")}</h2>
          <div className="text-zinc-900 text-base text-base font-normal mb-8">{t("create_ticket_page_step-3_subtitle")}</div>

          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
            {/* Calendar Picker */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="react-calendar-wrapper border border-gray-300 rounded-lg">
                <Calendar
                  onChange={setDate}
                  value={date}
                  minDate={new Date()}
                  locale={locale}
                  calendarType="gregory" // Week starts on Sunday
                  //formatShortWeekday={(locale, date) => date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1)}
                  prev2Label={null}  // Remove double prev
                  next2Label={null}  // Remove double next
                  className="calendar-component"
                  formatShortWeekday={(lc, dt) => {
                    const weekday = dt.toLocaleDateString(locale, { weekday: 'short' });
                    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
                  }}
                  formatMonthYear={(locale, date) => {
                    const month = date.toLocaleDateString(locale, { month: 'long' });
                    const year = date.getFullYear();
                    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
                  }}
                  formatDay={(locale, date) => {
                    const day = date.getDate().toString();
                    return day.charAt(0).toUpperCase() + day.slice(1);
                  }}
                />
              </div>

              <div className="relative inline-block text-left" ref={dropdownRef}>
                {/* Trigger Button */}
                <div
                  onClick={() => setIsOpen(!isOpen)}
                  className="inline-flex items-center justify-between w-60 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  <span className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {selectedTime || t('create_ticket_page_step-3_time_select')}
                  </span>
                  {isOpen ? <ChevronDown className="w-4 h-4 ml-2 text-gray-500" /> : <ChevronUp className="w-4 h-4 ml-2 text-gray-500" />}
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div className="absolute z-10 mt-2 w-60 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                    <ul className="p-2 text-base text-gray-700 max-h-72 justify-items-center overflow-y-auto grid grid-cols-3 gap-1">
                      {timeSlots.map((time) => (
                        <li key={time} className={`w-full text-center p-1 rounded-lg border ${selectedTime === time
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'hover:bg-primary hover:text-primary-foreground hover:text-white'
                          }`}>
                          <button
                            type='button'
                            onClick={() => {
                              setSelectedTime(time);
                              setIsOpen(false);
                            }}
                          >
                            {time}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

            </div>
            <div className='text-zinc-900 text-base font-medium my-8'>
              {t("create_ticket_page_step-3_selected_date_time")}
              <span className='underline ml-4 text-primary'>
                {
                  (() => {
                    const day = date.getDate();
                    const month = date.toLocaleDateString(locale, { month: 'long' });
                    const year = date.getFullYear();

                    const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

                    return `${day} ${capitalize(month)} ${year} `;
                  })()
                }
              </span> | <span className='underline text-primary'>{selectedTime || '08:00'}
              </span>
            </div>


            {/* Navigation Buttons */}
            <div className="mt-4 flex justify-end">
              <button type='button' onClick={() => setStep(1)} className="w-40 px-5 py-2 border border-2 border-primary bg-primary-foreground rounded-lg flex items-center justify-center text-primary text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {t('create_ticket_popup_button_back')}
              </button>
              <button type="submit" className="w-40 px-5 py-2 ml-2 border border-2 border-primary bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {t('create_ticket_popup_button_next')}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="w-full max-w-3xl mx-auto">
          <h2 className="text-zinc-900 text-xl font-semibold mb-4">{t("create_ticket_step-4_title")}</h2>

          {isSubmitModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-60">
              <div className="w-96 p-8 bg-white rounded-lg shadow-md border space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <CircleCheckBig className="w-6 h-6 text-emerald-500" />
                    <h2 className="text-lg font-semibold text-emerald-500">{t("create_ticket_popup_title")}</h2>
                  </div>
                  <X className="w-6 h-6 text-rose-500 cursur-pointer" onClick={() => setIsSubmitModalOpen(false)} />
                </div>
                <p className='px-2'>{t("create_ticket_popup_text")}</p>
                {/* Footer buttons */}
                <div className="flex justify-between pt-2">
                  <button type='button' onClick={() => navigate(`/`)} className="px-4 py-2 border border-2 border-primary bg-primary-foreground rounded-lg flex items-center justify-center text-primary text-base font-medium leading-normal hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-primary/20 hover:text-primary">
                    {t('create_ticket_popup_button_back_home')}
                  </button>
                  <button type='button' onClick={() => navigate(`/ticket/${responseId}`)} className="px-4 py-2 ml-2 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-pink-50 text-base font-medium leading-normal hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-primary/20 hover:text-primary">
                    {t('create_ticket_popup_button_view_ticket')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {submitLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center z-50">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white text-lg font-medium mt-4">{t("create_ticket_step-4_submitting_text")}</p>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-4_address")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li className='flex items-center'>
                  <span className="w-8 flex">
                    <MapPin className='w-4 h-4 mr-2' />
                  </span>
                  <span className="flex-1">{selectedRow?.db_address_street}</span>
                </li>
                <li className='ml-8 pb-1'>{selectedRow?.db_address} {selectedRow?.db_address_zip}</li>
              </ul>
            </div>

            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-4_equipment")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li className='flex items-center'>
                  <span className="w-8 flex">
                    <Wrench className="w-4 h-4" />
                  </span>
                  <span className="flex-1">{selectedRow?.name}</span>
                </li>
                <li className='ml-8 pb-1'>{selectedRow?.equipment_family_name}</li>
                <li className='ml-8 pb-1'>{selectedRow?.equipment_brand_name}</li>
                <li className='ml-8 pb-1'>{selectedRow?.equipment_model_name}</li>
              </ul>
            </div>

            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("create_ticket_step-4_properties")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li className='grid grid-cols-2 gap-4 items-start'>{t("create_ticket_step-4_barcode")}: <span className='font-semibold break-all'>{selectedRow?.barcode || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-4 items-end'>{t("create_ticket_step-4_serial_number")}: <span className='font-semibold break-all'>{selectedRow?.serial_number || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-4 items-start'>{t("create_ticket_step-4_our_ref")}: <span className='font-semibold break-all'>{selectedRow?.customer_reference || 'NA'}</span></li>
                <li className='grid grid-cols-2 gap-4 items-start'>{t("create_ticket_step-4_supplier_ref")}: <span className='font-semibold break-all'>{selectedRow?.id2 || 'NA'}</span></li>
              </ul>
            </div>

            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className='text-zinc-900 text-base font-semibold leading-normal'>{t("create_ticket_step-4_preferred_date_time")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li>{date.toLocaleDateString('en-GB')} {selectedTime}</li>
              </ul>
            </div>
            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className='text-zinc-900 text-base font-semibold leading-normal'>{t("create_ticket_step-4_severity")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li>
                  <span className={`font-medium me-2 ${severityType[ticketDetails.severity] || "text-gray-500"}`}>
                    {ticketDetails.severity}
                  </span>
                </li>
              </ul>
            </div>
            <div className='shadow-sm border rounded-lg bg-white p-4 '>
              <h4 className='text-zinc-900 text-base font-semibold leading-normal'>{t("create_ticket_step-4_ticket_subject")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium">
                <li>{ticketName}</li>
              </ul>
            </div>

            <div className='md:col-span-3 shadow-sm border bg-white rounded-lg p-4 '>
              <h4 className='text-zinc-900 text-base font-semibold leading-normal'>{t("create_ticket_step-4_description")}</h4>
              <hr className='my-2 w-32 border-gray-300' />
              <ul className="list-none list-inside text-slate-500 text-base font-medium min-h-24">
                <li>{ticketDetails.problemDescription}</li>
              </ul>

            </div>
            <div className='md:col-span-3 shadow-sm border bg-white rounded-lg p-4 '>
              <h4 className="text-zinc-900 text-base font-semibold leading-normal my-2">{t("create_ticket_step-4_files_uploaded")}</h4>

              {/* File Thumbnails Grid */}
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 min-h-8">
                {ticketDetails?.file && ticketDetails.file.map((file, index) => {
                  const fileURL = URL.createObjectURL(file);
                  const isImage = file.type.startsWith("image/");
                  const isPDF = file.type === "application/pdf";

                  return (
                    <div key={index} className="relative group w-32 h-auto">
                      {/* Thumbnail */}
                      {isImage ? (
                        <div>
                          <img src={fileURL} alt="Preview" className="w-32 h-32 object-cover rounded-md overflow-hidden" />
                          <p className="mt-2 text-base break-words whitespace-normal text-gray-800">{file.name}</p>
                        </div>
                      ) : (
                        <div className="">
                          {isPDF ? <FileText className="w-32 h-32 text-gray-600 object-cover rounded-md overflow-hidden" /> : <File className="w-32 h-32 text-gray-600 object-cover rounded-md overflow-hidden" />}
                          <p className="mt-2 text-base break-words whitespace-normal text-gray-800">{file.name}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type='button' onClick={() => setStep(2)} disabled={submitLoading}
              className="w-40 px-5 py-2 border border-2 border-primary bg-primary-foreground rounded-lg flex items-center justify-center text-primary text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
              {t('create_ticket_popup_button_back')}
            </button>
            <button onClick={handleSubmitTicket} disabled={submitLoading}
              className={`w-40 px-5 py-2 ml-2 border border-2 border-primary bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-base font-medium leading-normal text-primary-foreground ${submitLoading ? 'cursor-not-allowed' : 'hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]'}`}>
              {t('create_ticket_popup_button_confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTicket;