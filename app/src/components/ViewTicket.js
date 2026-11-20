import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { API_BASE_URL, appUrl } from '../config';
import { useParams } from 'react-router-dom';
import { fetchDocuments } from '../services/apiServiceDocuments';
import { downloadFiles } from "../services/apiServiceDownloads";
import { ToastContainer, toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { File, Eye, ArrowLeft, Circle, MapPin, Phone, Wrench, User, Calendar, ExternalLink, Image, Loader, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setPrimaryTheme } from "../utils/setTheme";

// db_table.id values used to find the work order linked to a ticket
const DB_TABLE_ID_JOBS = '8fbbd742-a3b1-439a-898a-16541ad8e7ef';   // task.to_db_table_id: ticket attached to a work order
const DB_TABLE_ID_TICKET = '448260E5-7A17-4381-A254-0B1D8FE53947'; // jobs.source_db_table_id: work order created from a ticket
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

// Opens a page of this app in a new tab. Must keep the opener (no "noopener"/"noreferrer"): the browser
// only copies sessionStorage - where the session lives without "Remember me" - to a tab opened this way,
// otherwise the new tab has no session and shows the login page. Same as the list screens.
const openAppPageInNewTab = (path) => window.open(`${window.location.origin}${appUrl(path)}`, '_blank');

const SingleTicket = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  setPrimaryTheme(auth?.colorPrimary);
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [ticketWorkOrder, setTicketWorkOrder] = useState();
  const [doc, setDoc] = useState([]);
  //const [file, setFile] = useState('');
  const [loading, setLoading] = useState(true);
  const [isURLLoading, setIsURLLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // State to manage active tab
  const [fileThumbnails, setFileThumbnails] = useState({});
  // false from the moment the Documents tab is opened until its document list has been fetched
  const [docsReady, setDocsReady] = useState(false);
  // true once a NON-empty document list was fetched for this ticket (then it is not fetched again)
  const docsCachedRef = useRef(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [downloading, setDownloading] = useState(null); // null | 'selected' | 'all'
  // persistence key (per ticket)
  const STORAGE_KEY = `SingleTicketState_${ticketId || 'global'}`;
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [expandedPreventives, setExpandedPreventives] = useState({});
  const { t } = useTranslation('singleTicket');

  const url = API_BASE_URL;

  const statusColors = useMemo(() => ({
    "In progress": "bg-yellow-100 text-yellow-600",
    "Planned": "bg-blue-100 text-blue-600",
    "To be Planned": "bg-purple-100 text-purple-600",
    "Escalated to WO": "bg-orange-100 text-orange-600",
    "Open": "bg-green-100 text-green-600",
    "Ready for Review": "bg-indigo-100 text-indigo-600",
    "Waiting for Parts": "bg-indigo-100 text-indigo-600",
    "Cancelled": "bg-red-100 text-red-600",
    "Completed": "bg-pink-100 text-pink-600",
  }), []);

  const statusDotColors = useMemo(() => ({
    "In progress": "bg-yellow-600 text-yellow-600",
    "Planned": "bg-blue-600 text-blue-600",
    "To be Planned": "bg-purple-600 text-purple-600",
    "Escalated to WO": "bg-orange-600 text-orange-600",
    "Open": "bg-green-600 text-green-600",
    "Ready for Review": "bg-indigo-600 text-indigo-600",
    "Waiting for Parts": "bg-indigo-600 text-indigo-600",
    "Cancelled": "bg-red-600 text-red-600",
    "Completed": "bg-pink-600 text-pink-600",
  }), []);

  // Location / equipment: from the ticket while it is linked to an equipment (to_db_table_id = project).
  // Once escalated in the portal the ticket is linked to the new work order (to_db_table_id = jobs), so the
  // location then comes from that work order (its equipment = jobs.project_id, its address).
  const location = useMemo(() => {
    if (ticket?.project_name || ticket?.project_db_address_street) {
      return {
        street: ticket.project_db_address_street,
        zip: ticket.project_db_address_zip,
        city: ticket.project_db_address_city,
        phone: ticket.project_db_address_phone,
        equipmentName: ticket.project_name,
        equipmentId: ticket.to_id_in_table,
      };
    }
    if (ticketWorkOrder?.project_name || ticketWorkOrder?.db_address_street) {
      return {
        street: [ticketWorkOrder.db_address_street, ticketWorkOrder.db_address_street_number].filter(Boolean).join(' '),
        zip: ticketWorkOrder.db_address_zip,
        city: ticketWorkOrder.db_address_city,
        phone: ticketWorkOrder.db_address_phone,
        equipmentName: ticketWorkOrder.project_name,
        equipmentId: ticketWorkOrder.project_id,
      };
    }
    return null;
  }, [ticket, ticketWorkOrder]);

  useEffect(() => {
    if (downloadMsg) {
      toast.success("Downloading!");
    }
  }, [downloadMsg]);

  // Drop documents of a previously viewed ticket; they are reloaded when the Documents tab opens
  useEffect(() => {
    setDoc([]);
    setFileThumbnails({});
    setDocsReady(false);
    docsCachedRef.current = false;
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;

    // Linked work order (also the source of Location and Equipment for escalated tickets):
    // - ticket attached to a work order (to_db_table_id = jobs): that work order
    // - otherwise: the work order created from this ticket (escalated), as in the legacy ServiceDesk
    const loadLinkedWorkOrder = async (ticketData) => {
      try {
        let workOrder = null;
        const attachedToJob = ticketData?.to_db_table_id?.toLowerCase() === DB_TABLE_ID_JOBS
          && ticketData?.to_id_in_table && ticketData.to_id_in_table !== EMPTY_GUID;

        if (attachedToJob) {
          workOrder = await fetchDocuments(`api/JobsView(${ticketData.to_id_in_table})`, 'GET', auth.authKey);
        } else {
          const response = await fetchDocuments(
            `api/JobsView?$filter=source_db_table_id+eq+${DB_TABLE_ID_TICKET}+and+source_id_in_table+eq+${ticketId}`,
            'GET', auth.authKey);
          workOrder = Array.isArray(response) ? response[0] : response?.value?.[0];
        }
        if (!cancelled) setTicketWorkOrder(workOrder?.id ? workOrder : undefined);
      } catch (err) {
        console.warn("Linked work order could not be loaded:", err);
      }
    };

    const getTicketDetails = async () => {
      if (!ticketId || !auth?.authKey) {
        setError(t('single_ticket_page_err_no_ticket_id_auth'));
        setLoading(false);
        return;
      }

      setTicketWorkOrder(undefined);
      try {
        const ticketData = await fetchDocuments(`api/TaskView(${ticketId})`, 'GET', auth.authKey);
        if (cancelled) return;
        // Wait for the linked work order so Location and Equipment / Linked to Work Order are complete when
        // the loading ends (a failure there is caught in loadLinkedWorkOrder and does not block the page)
        await loadLinkedWorkOrder(ticketData);
        if (cancelled) return;
        setTicket(ticketData);
        // Ticket documents are loaded lazily when the Documents tab is opened (see below)
      } catch (err) {
        console.error("Error fetching ticket:", err);
        if (!cancelled) setError(t('single_ticket_page_err_failed_to_fetch_all'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    getTicketDetails();
    return () => { cancelled = true; };
  }, [auth?.authKey, ticketId, t]);


  // Load the document list when the Documents tab is opened. Once files were loaded they are
  // cached for this ticket; an empty result is fetched again on the next open, so files that
  // were not yet available the first time show up without a page refresh.
  useEffect(() => {
    if (activeTab !== "documents" || !ticketId || !auth?.authKey) return undefined;
    if (docsCachedRef.current) return undefined;
    let cancelled = false;

    const refreshDocuments = async () => {
      try {
        const docEndpoint = `api/DbFileView?$filter=db_table_name+eq+%27task%27+and+id_in_table+eq+${ticketId}`;
        const docData = await fetchDocuments(docEndpoint, 'GET', auth.authKey);
        if (cancelled) return;
        const fresh = docData?.value || [];
        docsCachedRef.current = fresh.length > 0;
        // Keep the current array when nothing changed to avoid re-downloading thumbnails
        setDoc((prev) => {
          const same =
            prev.length === fresh.length &&
            prev.every((d, i) => d.id === fresh[i].id);
          return same ? prev : fresh;
        });
      } catch (err) {
        console.error("Error refreshing ticket documents:", err);
      } finally {
        if (!cancelled) setDocsReady(true);
      }
    };

    refreshDocuments();
    return () => {
      cancelled = true;
      // Nothing cached yet: show the loading state again the next time the tab opens
      if (!docsCachedRef.current) setDocsReady(false);
    };
  }, [activeTab, ticketId, auth?.authKey]);

  useEffect(() => {
    const GetFileThumbnails = async () => {
      try {
        if (!doc || doc.length === 0) return; // Ensure there is data

        const authKey = auth?.authKey;
        if (!authKey) return;

        const updatedThumbnails = {};

        await Promise.all(
          doc.map(async (item) => {
            if (!item.id) return;

            try {
              const endpoint = `api/DbFileView/GetFileThumbnail/?id=${item.id}&maxWidth=${item.image_width || '500'}&maxHeight=${item.image_heigth || '500'}`;

              const response = await fetchDocuments(
                endpoint,
                "GET",
                authKey,
                null,
                "image/png"
              );

              updatedThumbnails[item.id] = URL.createObjectURL(response);
            } catch (err) {
              console.warn(`Failed to load thumbnail for ${item.id}:`, err);
              // Skip just this one, let others continue
            }
          })
        );

        setFileThumbnails(updatedThumbnails);
      } catch (err) {
        console.error("Error fetching thumbnails:", err);
        // setError(t("single_ticket_page_err_failed_to_fetch_thumbnail"));
      } finally {
        setLoading(false);
      }
    };


    if (activeTab === "documents") {
      GetFileThumbnails();
    }
  }, [auth, doc, url, t, activeTab]); // Run when `doc` changes


  const handleDownloadAll = async () => {
    if (downloading) return;
    setDownloading('all');
    try {
      await downloadFiles(url, auth.authKey, doc.map(d => d.id));
      setDownloadMsg("Downloading all files...");
    } catch (err) {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadSelected = async () => {
    if (downloading) return;
    const ids = selectedFiles.map(f => f.id);

    let fallbackName = "download.zip";
    if (ids.length === 1) {
      const file = selectedFiles.find(f => f.id === ids[0]);
      if (file?.name) {
        fallbackName = file.name; // keep original filename if possible
      }
    }

    setDownloading('selected');
    try {
      await downloadFiles(url, auth.authKey, ids, fallbackName);
      setDownloadMsg("Downloading selected files...");
    } catch (err) {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  // Restore small UI state on mount (tab, selected file ids, expanded rows)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.activeTab) setActiveTab(saved.activeTab);
      if (Array.isArray(saved.selectedFileIds)) setSelectedFileIds(saved.selectedFileIds);
      if (saved.expandedRowId) setExpandedRowId(saved.expandedRowId);
      if (saved.expandedPreventives) setExpandedPreventives(saved.expandedPreventives);
    } catch (e) {
      // ignore parse/storage errors
    }
  }, [STORAGE_KEY]);

  // Reconcile stored file ids with loaded doc list
  useEffect(() => {
    if (!Array.isArray(selectedFileIds) || !Array.isArray(doc) || doc.length === 0) return;
    const sel = doc.filter(d => selectedFileIds.includes(d.id));
    setSelectedFiles(sel);
  }, [doc, selectedFileIds]);

  // Persist UI state when it changes
  useEffect(() => {
    try {
      const toSave = {
        activeTab,
        selectedFileIds,
        expandedRowId,
        expandedPreventives,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      // ignore storage errors
    }
  }, [activeTab, selectedFileIds, expandedRowId, expandedPreventives, STORAGE_KEY]);

  const toggleFileSelection = (file) => {
    setSelectedFiles((prev) => {
      const exists = prev.some((f) => f.id === file.id);
      const updated = exists ? prev.filter((f) => f.id !== file.id) : [...prev, file];
      setSelectedFileIds(updated.map(f => f.id));
      return updated;
    });
  };

  //// Function ////
  const openDocumentInNewTab = useCallback(async (id) => {
    if (!id || !auth?.authKey) return;

    setIsURLLoading(true); // Show loading overlay

    const endpoint = `api/DbFileView/View/?id=${id}`;
    try {
      const response = await fetchDocuments(
        endpoint,
        "GET",
        auth.authKey,
        null,
        "image/png"
      );

      if (response) {
        const blob = await response.blob?.() ?? response;
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.error("Failed to fetch thumbnail:", response?.statusText);
      }
    } catch (error) {
      console.error("Error fetching document thumbnail:", error);
    } finally {
      setIsURLLoading(false); // Hide loading overlay
    }
  }, [auth?.authKey]);


  if (loading) {
    return <div className="flex w-full items-center justify-center h-screen">
      <div className="relative">
        <div className="w-20 h-20 border-purple-200 border-2 rounded-full"></div>
        <div className="w-20 h-20 border-purple-700 border-t-2 animate-spin rounded-full absolute left-0 top-0"></div>
      </div>
    </div>;
  }
  if (error) return <div className="text-center text-red-600">{error}</div>;

  return (
    <div className="mx-auto w-full p-1 md:p-4 bg-white">
      <div className='flex'>
        {/* Back Button */}
        <button
          onClick={() => {
            if (activeTab !== 'details') {
              setActiveTab('details');
            } else {
              navigate(-1);
            }
          }}
          className="flex items-center mb-6 font-semibold text-zinc-900 text-base"
        >
          <ArrowLeft className="mr-2 w-5 h-5" /> {t("single_ticket_page_go_back")}
        </button>
      </div>

      <div className='shadow-md rounded-lg p-2 md:p-8'>
        <h2 className="capitalize text-zinc-900 text-lg md:text-2xl font-semibold mb-4">{t("single_ticket_page_reference")}: {ticket?.id2} | {ticket?.subject}</h2>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-4">
          <button
            className={`px-2 md:px-4 py-2 mr-2 text-md md:text-lg font-medium leading-7 ${activeTab === 'details' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-slate-500'}`}
            onClick={() => setActiveTab('details')}
          >
            {t("single_ticket_page_ticket_details")}
          </button>
          <button
            className={`px-2 md:px-4 py-2 mr-2 text-md md:text-lg font-medium leading-7 ${activeTab === 'documents' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-slate-500'}`}
            onClick={() => setActiveTab('documents')}
          >
            {t("single_ticket_page_documents")}
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className='grid grid-cols-1 md:grid-rows-3 gap-8'>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 row-start-1">
              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="block text-zinc-900 text-base font-semibold leading-normal">{t("single_ticket_page_location_equipment")}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                <ul className="list-none list-inside text-slate-500 text-base font-medium">
                  {location?.street ? (
                    <li className='flex items-center'>
                      <span className="w-8 flex"><MapPin className='w-4 h-4 mr-2' /></span>
                      <span className="flex-1">{location.street}</span>
                    </li>) : ''}
                  {location?.zip || location?.city ? (
                    <li className='ml-6 pb-1'>
                      {location.zip} {location.city}
                    </li>) : ''}
                  {location?.phone ? (
                    <li className='flex items-center pb-1'>
                      <span className="w-8 flex"><Phone className='w-4 h-4 mr-2' /></span>
                      <span className="flex-1">{location.phone}</span>
                    </li>) : ''}
                  {location?.equipmentName && (
                    <li
                      className={`flex items-center ${location.equipmentId && location.equipmentId !== EMPTY_GUID ? 'cursor-pointer' : ''}`}
                    >
                      <span className="w-8 flex"><Wrench className='w-4 h-4 mr-2' /></span>
                      <span className="flex justify-between flex-1">{location.equipmentName}
                        {location.equipmentId && location.equipmentId !== EMPTY_GUID && (
                          <a href={appUrl(`/equipment/${location.equipmentId}`)} className=""
                            onClick={(e) => { e.preventDefault(); openAppPageInNewTab(`/equipment/${location.equipmentId}`); }}>
                            <ExternalLink className="ml-2 w-5 h-5" />
                          </a>
                        )}
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t("single_ticket_page_created_by")}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                <ul className="list-none list-inside text-slate-500 text-base font-medium">
                  <li className='flex items-center pb-1'>
                    <User className='w-4 h-4 mr-2' />
                    {ticket?.contact_fullname}
                  </li>
                  <li className='flex items-center'>
                    <Calendar className='w-4 h-4 mr-2' />
                    {(new Date(ticket?.date_create).getFullYear() !== 1980) ?
                      new Date(ticket?.date_create).toLocaleString('en-GB', {
                        timeZone: 'UTC',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false // optional: use 24-hour format
                      })
                      : ''}
                  </li>
                </ul>
              </div>

              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t('single_ticket_page_assigned_to')}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                <ul className="list-none list-inside text-slate-500 text-base font-medium">
                  <li className='flex items-center pb-1'><User className='w-4 h-4 mr-2' />{ticket?.assigned_to_user_fullname?.trim() ? ticket.assigned_to_user_fullname : 'Not Assigned'}</li>
                  {ticket?.date_assigned && new Date(ticket.date_assigned).getFullYear() !== 1980 && (
                    <li className='flex items-center'>
                      <Calendar className='w-4 h-4 mr-2' />
                      {new Date(ticket.date_assigned).toLocaleString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${ticketWorkOrder ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 row-start-2`}>
              {/* <div className={`grid grid-cols-3 gap-8 row-start-2`}> */}
              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t('single_ticket_page_severity')}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                <span className="text-slate-500 text-base font-medium">
                  {ticket?.task_priority_name}
                </span>
              </div>

              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t('single_ticket_page_type_status')}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                <ul className="list-none list-inside text-slate-500 text-base font-medium">
                  <li className='pb-1'>
                    {ticket?.task_type_name}
                  </li>
                  <li className='mt-2.5'><span className={`pe-3 px-2 pb-1 pt-0.5 rounded-full ${statusColors[ticket?.task_status_name] || "bg-gray-200 text-gray-800"}`}>
                    <Circle className={`inline w-2 h-2 mr-1 rounded-full ${statusDotColors[ticket?.task_status_name] || "bg-gray-800 text-gray-800"}`} />
                    {ticket?.task_status_name}
                  </span></li>
                </ul>
              </div>

              {ticketWorkOrder && (
                <div className='shadow-sm border rounded-lg p-4 '>
                  <h4 className="text-zinc-900 text-base font-semibold leading-normal">{t('single_ticket_page_linked_wo')}</h4>
                  <hr className='my-2 w-32 border-gray-300' />
                  <ul className="list-none list-inside text-slate-500 text-base font-medium">
                    <li className='flex justify-between items-center pb-1 cursor-pointer' onClick={() => openAppPageInNewTab(`/workorder/${ticketWorkOrder.id}`)}>
                      {ticketWorkOrder.reference_back_office?.trim() || ticketWorkOrder.id2} <ExternalLink className="ml-2 w-5 h-5" />
                    </li>
                    <li className='flex items-center pb-1'>{ticketWorkOrder?.job_type_name}</li>
                    <li className='flex items-center pb-1'>{ticketWorkOrder?.name}</li>
                  </ul>
                </div>)}
            </div>

            <div className="row-start-3">
              <div className='shadow-sm border rounded-lg p-4 '>
                <h4 className="block text-zinc-900 text-base font-semibold leading-normal">{t('single_ticket_page_description')}</h4>
                <hr className='my-2 w-32 border-gray-300' />
                {ticket?.remark ? (
                  <p className="mb-4 text-slate-500 text-base font-medium">{ticket?.remark}</p>
                ) : (
                  <p className="mb-4 text-slate-500 text-base font-medium">{t('single_ticket_page_no_description')}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className=''>
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
            {
              isURLLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/10">
                  <div className="text-white text-lg font-semibold animate-pulse">
                    <Loader className="w-20 h-20 ml-2 text-blue-600 animate-spin" />
                  </div>
                </div>
              )
            }
            {!docsReady ? (
              <div className="flex items-center justify-center p-10" role="status" aria-live="polite">
                <Loader className="w-10 h-10 text-primary animate-spin" />
              </div>
            ) : doc?.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                {doc.map(item => (
                  <div key={item.id} className="p-2 flex flex-col border rounded-lg shadow-md">
                    <div className='flex flex-col items-center'>
                      {/* Show image thumbnail if it's an image, otherwise show file icon */}
                      {item.mime_type?.startsWith("image/") ? (
                        fileThumbnails[item.id] ? (
                          <img
                            src={fileThumbnails[item.id]}
                            alt={item.name}
                            className="w-full h-40 md:h-48 object-cover rounded-md mx-auto"
                          />
                        ) : (
                          <div className="relative w-40 md:w-48 h-40 md:h-48 flex items-center justify-center mx-auto bg-gray-100 rounded-md">
                            {/* Loading overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
                              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gray-500"></div>
                            </div>

                            {/* Fallback icon */}
                            <Image className="w-20 h-20 text-gray-300" />
                          </div>
                        )
                      ) : (
                        <File className="w-40 md:w-48 h-40 md:h-48 text-gray-600 mx-auto" />
                      )}
                    </div>
                    <div className='flex flex-col'>
                      <h4 className="text-gray-500 text-base py-1 break-words">{item.name}</h4>

                      <p className="text-gray-500 text-base">{new Date(item.date_add).toLocaleString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}</p>

                      {item.file_name ? (
                        <label className="mt-2 flex space-x-2 items-start text-base">
                          <input
                            type="checkbox"
                            onChange={() => toggleFileSelection(item)}
                            checked={selectedFiles.some((file) => file.id === item.id)}
                            className='mt-1'
                          /><span>{t("single_ticket_page_select_to_download")}</span>
                        </label>) : null}

                      {/* Show "View Document" only if it's an image */}
                      {item.mime_type?.startsWith("image/") ? (
                        <button
                          target="_blank"
                          rel={item.mime_type?.startsWith("image/") ? "noopener noreferrer" : "noreferrer"}
                          className={`flex items-center no-underline mt-2 text-base ${fileThumbnails[item.id] ? "hover:underline" : "cursor-not-allowed pointer-events-none"
                            }`}
                          onClick={() => openDocumentInNewTab(item.id)}
                        >
                          <Eye className="w-6 h-6 mr-2 text-gray-600" />
                          {t("single_ticket_page_view_document")}
                        </button>
                      ) : (
                        <button
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center no-underline mt-2 text-base hover:underline"
                          onClick={() => openDocumentInNewTab(item.id)}
                        >
                          <Eye className="w-6 h-6 mr-2 text-gray-600" />
                          {t("single_ticket_page_view_document")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (<p className="text-gray-800 p-4 font-semibold">{t("single_ticket_page_no_document")}</p>)
            }
            {!fileThumbnails && (!doc || doc.length === 0) && (
              <p className="text-gray-400 p-4 text-center">{t("single_ticket_page_no_document")}</p>
            )}
            {docsReady && doc.length > 0 && (
              <div className='flex justify-end mt-4'>
                {selectedFiles.length !== 0 && (
                  <button
                    onClick={handleDownloadSelected}
                    disabled={!!downloading}
                    aria-busy={downloading === 'selected'}
                    className="w-48 px-4 py-2 bg-primary border border-2 border-primary rounded-lg flex items-center justify-center text-primary-foreground text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] disabled:opacity-60 disabled:cursor-not-allowed">
                    {t("single_ticket_page_download_button")}{" "}
                    {downloading === 'selected'
                      ? <Loader className="ml-2 w-5 h-5 animate-spin" />
                      : <Download className="ml-2 w-6 h-5" />}
                  </button>)}
                <button
                  onClick={handleDownloadAll}
                  disabled={!!downloading}
                  aria-busy={downloading === 'all'}
                  className="w-48 px-4 py-2 ml-2 bg-primary-foreground border border-2 border-primary rounded-lg flex items-center justify-center text-primary text-base font-medium leading-normal hover:bg-primary/20 hover:text-primary hover:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] disabled:opacity-60 disabled:cursor-not-allowed">
                  {t("single_ticket_page_download_all_button")}{" "}
                  {downloading === 'all'
                    ? <Loader className="ml-2 w-5 h-5 animate-spin" />
                    : <Download className="ml-2 w-6 h-5" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleTicket;