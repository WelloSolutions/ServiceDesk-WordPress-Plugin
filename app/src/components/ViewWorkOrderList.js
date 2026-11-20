import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { APP_BASENAME } from '../config';
import { useTable, useSortBy, useExpanded, usePagination } from 'react-table';
import { fetchDocuments } from '../services/apiServiceDocuments';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowLeftToLine, ArrowRightToLine, BadgeInfo, Circle, CalendarClock, FileText, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useTranslation } from "react-i18next";
import { setPrimaryTheme } from "../utils/setTheme";
import { TableSkeletonRows } from '../utils/setTableSkleton.js';
import ColumnFilter, { isFilterActive } from './ColumnFilter';

// SD-511: sorting is done by the API (JobsView/SearchPaged). Rows are loaded in blocks of BLOCK_SIZE and
// cached per tab + sort until the user leaves the screen; pages are cut from the cached blocks.
const PAGE_SIZES = [12, 24, 36, 48];
const BLOCK_SIZE = 144; // divisible by every page size, so a page always fits in one block
const DATE_COLUMN_ID = 'planned_or_closed_date'; // planned date on the open tab, closing date on the completed tab

// Table column id -> filter column of JobsView/SearchPaged (the date column depends on the tab)
const FILTER_COLUMNS = {
  id2: 'reference',
  name: 'name',
  db_address_street: 'address',
  job_type_name: 'job_type',
  job_status_name: 'job_status',
};

const toApiFilters = (filters, isCompleted) =>
  Object.entries(filters)
    .filter(([, filter]) => isFilterActive(filter))
    .map(([columnId, filter]) => ({
      column: columnId === DATE_COLUMN_ID ? (isCompleted ? 'date_closed' : 'first_planning_date') : FILTER_COLUMNS[columnId],
      op: filter.op,
      value: filter.value ?? null,
      value2: filter.value2 ?? null,
      values: filter.values ?? null,
    }))
    .filter(filter => filter.column);

const ViewWorkOrderList = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  setPrimaryTheme(auth?.colorPrimary);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [jobsStatus, setJobsStatus] = useState([]);
  const [jobsType, setJobsType] = useState([]);
  const [translationsLoaded, setTranslationsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Column filters: table column id -> { op, value, value2, values }
  const [filters, setFilters] = useState({});
  const setColumnFilter = useCallback((columnId, filter) => {
    setFilters(prev => {
      const next = { ...prev };
      if (filter) next[columnId] = filter; else delete next[columnId];
      return next;
    });
  }, []);
  const hasFilters = Object.values(filters).some(isFilterActive);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('open');


  const [expandedRowId, setExpandedRowId] = useState(null);
  const [activeSection, setActiveSection] = useState(null); // 'popup' | 'remarks'

  const [popupDataMap, setPopupDataMap] = useState({});
  const [remarksDataMap, setRemarksDataMap] = useState({});

  const [loadingMap, setLoadingMap] = useState({});

  const { t, i18n } = useTranslation('workOrderList');
  const { t: tCommon } = useTranslation('common');

  useEffect(() => {
    if (translationsLoaded) return;

    const fetchStatusTranslations = async () => {
      const response = await fetchDocuments(`/api/JobStatusView/Translations`, 'GET', auth.authKey);
      //console.log('Work Order Status Translations:', response);
      setJobsStatus(response);
    };
    const fetchTypeTranslations = async () => {
      const response = await fetchDocuments(`/api/JobTypeView/Translations`, 'GET', auth.authKey);
      //console.log('Work Order Type Translations:', response);
      setJobsType(response);
    };
    fetchStatusTranslations();
    fetchTypeTranslations();
    setTranslationsLoaded(true);
  }, [auth, translationsLoaded]);

  const statusJob = useMemo(() => ({
    "9ac4bd6d-f6e8-df11-97cf-0030488c6c36": {
      "name": "Attivato",
      "statusColors": "bg-violet-100 text-violet-600",
      "statusDotColors": "bg-violet-600 text-violet-600",
    },
    "8adbc894-d612-de11-bd84-0030488c6c36":
    {
      "name": "Pooling",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "69268600-d3e0-4222-859f-06e47cf4041e":
    {
      "name": "En attente",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "9080edc8-18c1-457a-909b-30c40685e6bb":
    {
      "name": "FA time out",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "ff20244f-07c6-4c9d-9ed0-3564bd252560": {
      "name": "Verplaatst",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "2ff8949f-6689-4864-aab3-49256914c195": {
      "name": "Verlaat",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "f79e58ee-ee04-4590-bcb1-49e8bd551659": {
      "name": "In Progress",
      "statusColors": "bg-yellow-100 text-yellow-600",
      "statusDotColors": "bg-yellow-600 text-yellow-600",
    },
    "143cf9cd-c3c1-406a-a19a-58d766d9dda9": {
      "name": "Suggested",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "fc28469f-c276-4ff5-abb7-b99f5aee4c7d":
    {
      "name": "In progress (W)",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "0add3d6d-62ce-4b60-b31c-591425946f28": {
      "name": "En train de finir",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "6557b9dc-6106-4327-8e26-6f24d0329c33": {
      "name": "Completed",
      "statusColors": "bg-pink-100 text-pink-600",
      "statusDotColors": "bg-pink-600 text-pink-600",
    },
    "22b150a0-6633-48cd-89c4-81aebeb895f3": {
      "name": "Accettato",
      "statusColors": "bg-green-100 text-green-600",
      "statusDotColors": "bg-green-600 text-green-600",
    },
    "09444873-6d8e-4793-a069-8955a760e4c1": {
      "name": "FA Rejected",
      "statusColors": "bg-red-100 text-red-600",
      "statusDotColors": "bg-red-600 text-red-600",
    },
    "8ba9da71-ef32-423a-bb50-ae767315f55c": {
      "name": "Open",
      "statusColors": "bg-green-100 text-green-600",
      "statusDotColors": "bg-green-600 text-green-600",
    },
    "1a908c70-10b1-44e8-a8c2-c5bcb9e35acc": {
      "name": "FA Pending",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "06ea451c-5863-4c97-9592-cc928dfdf869": {
      "name": "Canceled",
      "statusColors": "bg-red-100 text-red-600",
      "statusDotColors": "bg-red-600 text-red-600",
    },
    "497acff2-9ff6-4c94-85dd-daa0689553e2": {
      "name": "To be planned",
      "statusColors": "bg-blue-100 text-blue-600",
      "statusDotColors": "bg-blue-600 text-blue-600",
    },
    "136e1585-dff6-4990-bfc6-dba958b71f30": {
      "name": "Waiting Further Actions",
      "statusColors": "bg-orange-100 text-orange-600",
      "statusDotColors": "bg-orange-600 text-orange-600",
    },
    "10f456d2-000e-48ea-93d7-e016107b7a98": {
      "name": "Gepland",
      "statusColors": "bg-yellow-100 text-yellow-600",
      "statusDotColors": "bg-yellow-600 text-yellow-600",
    },
    "a60bc691-ab2f-42f5-8a5b-998a29a27537": {
      "name": "DispatchedNL",
      "statusColors": "bg-blue-100 text-blue-600",
      "statusDotColors": "bg-blue-600 text-blue-600",
    },
    "eb014da9-5850-4e16-b1e9-527162f1a9e0": {
      "name": "Dispatched - geweigerd",
      "statusColors": "bg-blue-100 text-blue-600",
      "statusDotColors": "bg-blue-600 text-blue-600",
    },
    "8d0b7286-36b8-4949-949c-2f3a3f3d82f6": {
      "name": "In wacht - Account geblokkeerd",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "fad3eb19-ed15-4d4c-b4a9-a1fd17f81847": {
      "name": "On hold - Credit blocked",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "46b11d59-3de5-47d5-826d-72462e138aae": {
      "name": "On hold - Credit released",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "1c6f7a61-3723-450b-8158-19a90d60cbd9": {
      "name": "Workshop - Waiting further action",
      "statusColors": "bg-orange-100 text-orange-600",
      "statusDotColors": "bg-orange-600 text-orange-600",
    },
    "ce5f26ed-5fe0-47a3-94a7-1bf4402e32d0": {
      "name": "Workshop - Completed",
      "statusColors": "bg-pink-100 text-pink-600",
      "statusDotColors": "bg-pink-600 text-pink-600",
    },
    "bea7aa41-fa53-4f2c-b766-2933579f1212": {
      "name": "Klaar voor Review",
      "statusColors": "bg-purple-100 text-purple-600",
      "statusDotColors": "bg-purple-600 text-purple-600",
    },
    "e2bc66af-bd10-4035-8aa1-7ad88cb35723": {
      "name": "Workshop",
      "statusColors": "bg-violet-100 text-violet-600",
      "statusDotColors": "bg-violet-600 text-violet-600",
    },
    "41a3718f-eaa1-4ef4-9a82-2ccf3fa92bcc": {
      "name": "Wachtrij werkplaats",
      "statusColors": "bg-violet-100 text-violet-600",
      "statusDotColors": "bg-violet-600 text-violet-600",
    }
  }), []);

  const handleCalendarClick = useCallback(async (rowId) => {
    // if same row clicked again, toggle collapse
    if (expandedRowId === rowId && activeSection === "popup") {
      setExpandedRowId(null);
      setActiveSection(null);
      return;
    }

    setExpandedRowId(rowId);
    setActiveSection("popup");

    // if cached, don’t refetch
    if (popupDataMap[rowId]) return;

    setLoadingMap(prev => ({ ...prev, [rowId]: true }));
    try {
      const response = await fetchDocuments(`api/JobPlanningView?$filter=jobs_id eq ${rowId}&$orderby=date_from`);
      const res = response.value;
      setPopupDataMap(prev => ({ ...prev, [rowId]: res }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [rowId]: false }));
    }
  }, [expandedRowId, activeSection, popupDataMap]);

  const handleRemarksClick = useCallback(async (rowId) => {
    // if same row clicked again, toggle collapse
    if (expandedRowId === rowId && activeSection === "remarks") {
      setExpandedRowId(null);
      setActiveSection(null);
      return;
    }

    setExpandedRowId(rowId);
    setActiveSection("remarks");

    if (remarksDataMap[rowId]) return;

    setLoadingMap(prev => ({ ...prev, [rowId]: true }));
    try {
      const response = await fetchDocuments(`api/JobsView/GetAllTechnicianRemarksOfJob?jobs_id=${rowId}`);
      const res = response;
      setRemarksDataMap(prev => ({ ...prev, [rowId]: res }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [rowId]: false }));
    }
  }, [expandedRowId, activeSection, remarksDataMap]);


  // Options of the type / status filters: id + name in the current language (same as the cells)
  const toFilterOptions = useCallback((list) => {
    const lang = i18n.language.split("-")[0].toUpperCase();
    return (Array.isArray(list) ? list : [])
      .map(item => ({
        value: String(item.id),
        label: item.translations?.find(tr => tr.language_code === lang)?.value ?? item.name ?? '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [i18n.language]);

  const columns = useMemo(
    () => [
      {
        id: DATE_COLUMN_ID,
        Header: () =>
          !isCompleted
            ? t('work_order_list_table_heading_planned_date_text')
            : t('work_order_list_table_heading_closing_date_text'),

        accessor: row => !isCompleted ? row.first_planning_date : row.date_closed,
        filterType: 'date',

        Cell: ({ row, value }) => {
          const displayDate =
            new Date(value).getFullYear() !== 1980
              ? new Date(value).toLocaleDateString("en-GB", {
                year: '2-digit',
                month: '2-digit',
                day: '2-digit',
              })
              : ' ';

          const showCalendarIcon = !isCompleted && row.original.job_planning_count > 1;
          const showFileIcon = row.original.nb_notes > 0;

          return (
            <span className="flex justify-between items-center gap-2">
              <span>{displayDate}</span>
              <span className="flex gap-2 justify-end">
                {showCalendarIcon && (
                  <CalendarClock
                    className="w-5 h-5 cursor-pointer"
                    onClick={() => handleCalendarClick(row.original.id)}
                  />
                )}
                {showFileIcon && (
                  <FileText
                    className="w-5 h-5 cursor-pointer"
                    onClick={() => handleRemarksClick(row.original.id)}
                  />
                )}
              </span>
            </span>
          );
        }
      },
      {
        Header: t('work_order_list_table_heading_reference_text'), accessor: 'id2',
        filterType: 'text', // the back office reference may contain letters
        Cell: ({ row }) => (
          <div className="text-center">
            <span className="font-medium">
              {row.original.id2}
            </span>
          </div>
        ),
      },
      {
        Header: t('work_order_list_table_heading_name_text'), accessor: 'name',
        filterType: 'text',
        Cell: ({ value }) => {
          const text = value ?? '';
          return text.length > 30 ? text.slice(0, 30) + '...' : text;
        }
      },
      {
        Header: t('work_order_list_table_heading_address_text'), accessor: 'db_address_street',
        filterType: 'text',
        filterOps: ['contains'],
        Cell: ({ row }) => (
          <span>
            {row.original.db_address_street} {row.original.db_address_city} {row.original.db_address_zip}
          </span>
        ),
      },
      {
        Header: t('work_order_list_table_heading_type_text'), accessor: 'job_type_name',
        filterType: 'options',
        filterOptions: toFilterOptions(jobsType),
        Cell: ({ row }) => (
          <span className={`text-base`}>
            {
              jobsType.find(type => String(type.id) === String(row.original.job_type_id))?.translations
                ?.find(t => t.language_code === i18n.language.split("-")[0].toUpperCase())?.value
              ?? jobsType.find(type => String(type.id) === String(row.original.job_type_id))?.name
              ?? row.original.job_type_name
            }
          </span>
        ),
      },
      {
        Header: t('work_order_list_table_heading_status_text'), accessor: 'job_status_name',
        filterType: 'options',
        filterOptions: toFilterOptions(jobsStatus),
        Cell: ({ row }) => (
          <span className={`text-base min-w-max inline-flex items-center font-medium pe-3 px-2 pb-1 pt-1 rounded-full ${statusJob[row.original.job_status_id]?.statusColors || "bg-gray-200 text-gray-800"}`}>
            <Circle className={`inline w-2 h-2 mr-1 rounded-full ${statusJob[row.original.job_status_id]?.statusDotColors || "bg-gray-800 text-gray-800"}`} /> {row.original.project_status_name}
            {
              jobsStatus.find(status => String(status.id) === String(row.original.job_status_id))?.translations
                ?.find(t => t.language_code === i18n.language.split("-")[0].toUpperCase())?.value
              ?? jobsStatus.find(status => String(status.id) === String(row.original.job_status_id))?.name
              ?? row.original.job_status_name
            }
          </span>
        ),
      },
    ],
    [jobsType, jobsStatus, statusJob, isCompleted, handleCalendarClick, handleRemarksClick, t, i18n.language, toFilterOptions]
  );


  // Create table instance with pagination
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page, // Use page instead of rows for pagination
    prepareRow,
    canPreviousPage,
    canNextPage,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize, sortBy },
  } = useTable(
    {
      columns,
      data: jobs,
      manualPagination: true,
      manualSortBy: true,
      pageCount,
      autoResetPage: false,
      autoResetSortBy: false,
      autoResetExpanded: false,
      disableMultiSort: true,
      initialState: { pageIndex: 0, pageSize: PAGE_SIZES[0] },
    },
    useSortBy,
    useExpanded,
    usePagination,
  );

  // Tab + sort + filters: when it changes the list restarts at the first page
  const apiFilters = useMemo(() => toApiFilters(filters, isCompleted), [filters, isCompleted]);
  const queryKey = `${isCompleted}|${JSON.stringify(sortBy)}|${JSON.stringify(apiFilters)}`;
  const prevQueryKey = useRef(queryKey);
  const requestSeq = useRef(0);
  // queryKey -> { total, blocks: Map<blockIndex, rows[]>, pending: Map<blockIndex, Promise> }.
  // Kept until the user leaves the screen; a page refresh loads fresh data.
  const cacheRef = useRef(new Map());
  const authKey = auth?.authKey;

  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey;
      if (pageIndex !== 0) {
        gotoPage(0); // the effect runs again for page 0
        return;
      }
    }

    const sort = sortBy[0];
    // The date column is the planned date on the open tab and the closing date on the completed tab
    const sortColumn = sort ? (sort.id === DATE_COLUMN_ID ? (isCompleted ? 'date_closed' : 'first_planning_date') : sort.id) : null;

    let entry = cacheRef.current.get(queryKey);
    if (!entry) {
      entry = { total: null, blocks: new Map(), pending: new Map() };
      cacheRef.current.set(queryKey, entry);
    }

    // Loads one block of BLOCK_SIZE rows once; concurrent calls share the same request
    const loadBlock = (blockIndex) => {
      if (entry.blocks.has(blockIndex)) return Promise.resolve();
      if (entry.pending.has(blockIndex)) return entry.pending.get(blockIndex);

      const payload = {
        completed: isCompleted,
        page: blockIndex,
        pageSize: BLOCK_SIZE,
        sortBy: sortColumn,
        sortDesc: sort ? !!sort.desc : false,
        filters: apiFilters,
      };
      const request = fetchDocuments('api/JobsView/SearchPaged', 'POST', authKey, payload)
        .then(response => {
          entry.total = response?.total ?? 0;
          entry.blocks.set(blockIndex, response?.items ?? []);
        })
        .finally(() => entry.pending.delete(blockIndex));
      entry.pending.set(blockIndex, request);
      return request;
    };

    const firstRow = pageIndex * pageSize;
    const blockIndex = Math.floor(firstRow / BLOCK_SIZE); // a page never spans two blocks (BLOCK_SIZE % pageSize === 0)
    const offset = firstRow % BLOCK_SIZE;

    const show = () => {
      const rows = entry.blocks.get(blockIndex) ?? [];
      setJobs(rows.slice(offset, offset + pageSize));
      setTotal(entry.total);
      setPageCount(Math.max(1, Math.ceil(entry.total / pageSize)));
      setError(null);
      setIsLoading(false);

      // On the last page of a block, load the next block in the background
      const nextBlockStart = (blockIndex + 1) * BLOCK_SIZE;
      if (offset + pageSize >= BLOCK_SIZE && nextBlockStart < entry.total) {
        loadBlock(blockIndex + 1).catch(() => { }); // retried when the page is opened
      }
    };

    const seq = ++requestSeq.current;
    if (entry.blocks.has(blockIndex)) {
      show();
      return;
    }

    setIsLoading(true);
    loadBlock(blockIndex)
      .then(() => {
        if (seq === requestSeq.current) show(); // ignore if the user moved on meanwhile
      })
      .catch(err => {
        if (seq === requestSeq.current) {
          setError(err);
          setIsLoading(false);
        }
      });
  }, [queryKey, pageIndex, pageSize, isCompleted, sortBy, apiFilters, gotoPage, authKey]);

  // if (loading) {
  //   return <div className="flex w-full items-center justify-center h-screen">
  //     <div className="relative">
  //       <div className="w-20 h-20 border-purple-200 border-2 rounded-full"></div>
  //       <div className="w-20 h-20 border-purple-700 border-t-2 animate-spin rounded-full absolute left-0 top-0"></div>
  //     </div>
  //   </div>;
  // }

  if (error) {
    return <div className="text-center mt-10 text-red-600">Error fetching jobs: {error.message}</div>;
  }

  return (
    <div className="w-full mx-auto p-1 md:p-8">
      <h1 className="text-zinc-900 text-3xl font-semibold mb-6">{t("work_order_list_page_title")}</h1>

      {/* Back Button */}
      <button
        onClick={() => navigate('/')} // Navigate back one step in history
        className="flex items-center mb-6 font-semibold text-zinc-900 text-base"
      >
        <ArrowLeft className="mr-2 w-5 h-5" /> {t("work_order_list_page_go_back")}
      </button>

      <div className='shadow-md rounded-lg'>
        {/* Tabs for Open and Completed Jobs */}
        <div className="mb-4">
          <button
            className={`px-4 py-2 mr-2 font-semibold leading-7 ${selectedTab === 'open' ? 'text-gray-900 border-b-2 border-zinc-800' : 'text-slate-500'}`}
            onClick={() => {
              setSelectedTab('open');
              setIsCompleted(false);
            }}
          >
            {t("work_order_list_toggle_pending_text")}
          </button>

          <button
            className={`px-4 py-2 font-semibold leading-7 ${selectedTab === 'completed' ? 'text-gray-900 border-b-2 border-zinc-800' : 'text-slate-500'}`}
            onClick={() => {
              setSelectedTab('completed');
              setIsCompleted(true);
            }}
          >
            {t("work_order_list_toggle_completed_text")}
          </button>

        </div>

        <div className="bg-blue-100 flex items-center justify-between text-blue-500 text-base font-normal px-4 py-1 mb-2 rounded-lg">
          <span className="flex items-center">
            <BadgeInfo className='mr-2 w-5 h-5 text-blue-500' /> {t("work_order_list_page_helping_text")}
          </span>
          {hasFilters && (
            <button onClick={() => setFilters({})} className="flex items-center text-sm font-medium text-primary hover:underline">
              <X className="w-4 h-4 mr-1" /> {tCommon("filter_clear_all")}
            </button>
          )}
        </div>

        {/* Table displaying filtered jobs */}
        <div className="overflow-x-auto">
          <table {...getTableProps()} className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-100">
              {headerGroups.map((headerGroup, hgIdx) => {
                const headerGroupProps = headerGroup.getHeaderGroupProps();
                const { key: headerGroupKey, ...restHeaderGroupProps } = headerGroupProps;
                return (
                  <tr key={headerGroupKey || hgIdx} {...restHeaderGroupProps} className="bg-white divide-x divide-gray-300">
                    {headerGroup.headers.map((column, colIdx) => {
                      const sortProps = column.getSortByToggleProps();
                      const headerProps = column.getHeaderProps(sortProps);
                      const { key: headerKey, ...restHeaderProps } = headerProps;
                      return (
                        <th
                          key={headerKey || column.id || column.accessor || colIdx}
                          {...restHeaderProps}
                          className={`px-2 py-3 text-left whitespace-nowrap text-slate-500 text-base font-medium leading-none ${colIdx !== 0 ? 'border-r border-gray-300' : ''}`}
                        >
                          {column.render('Header')}
                          {column.filterType && (
                            <ColumnFilter
                              type={column.filterType}
                              ops={column.filterOps}
                              options={column.filterOptions}
                              value={filters[column.id]}
                              onChange={(filter) => setColumnFilter(column.id, filter)}
                            />
                          )}
                          {column.isSorted ? (
                            column.isSortedDesc ? (
                              <ArrowDown className="inline w-4 h-4 ml-1" />
                            ) : (
                              <ArrowUp className="inline w-4 h-4 ml-1" />
                            )
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                );
              })}
            </thead>
            <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200">
              {!isLoading &&
                page.map((row, rowIdx) => {
                  prepareRow(row);
                  const rowProps = row.getRowProps();
                  const { key: rowKey, ...restRowProps } = rowProps;
                  return (
                    <React.Fragment key={rowKey || row.original.id || rowIdx}>
                      {/* Normal row */}
                      <tr {...restRowProps} className="cursor-pointer hover:bg-primary/50 hover:text-primary-foreground transition-colors duration-200 ease-in-out">
                        {row.cells.map((cell, cellIdx) => {
                          const cellProps = cell.getCellProps();
                          const { key: cellKey, ...restCellProps } = cellProps;

                          return (
                            <td
                              key={cellKey || cellIdx}
                              {...restCellProps}
                              className={`self-stretch p-2 text-base font-normal ${cellIdx !== 0 ? 'cursor-pointer' : ''}`}
                              onClick={cellIdx !== 0 ? () => window.open(`${window.location.origin}${APP_BASENAME}/workorder/${row.original.id}`, "_blank") : undefined}
                            >
                              {cell.render("Cell")}
                            </td>
                          );
                        })}
                      </tr>

                      {expandedRowId === row.original.id && (
                        <>
                          {/* --- Planned Dates and Technicians --- */}
                          {activeSection === "popup" && (
                            <>
                              {loadingMap[row.original.id] ? (
                                <tr>
                                  <td colSpan={row.cells.length} className="bg-gray-50 p-4 text-center">
                                    <div className="ml-2 space-y-2 p-2">
                                      <div className="h-6 bg-gray-200 rounded animate-pulse w-64"></div>
                                      <div className="h-6 bg-gray-200 rounded animate-pulse w-40"></div>
                                    </div>
                                  </td>
                                </tr>
                              ) : popupDataMap[row.original.id]?.length > 0 && (
                                <tr>
                                  <td colSpan={row.cells.length} className="bg-gray-50 p-4">
                                    <div className="p-1">
                                      <h4 className="text-base font-semibold border-b-2 border-gray-200 pb-2 mb-2">
                                        {t("work_order_list_table_page_planned_date_technician")}
                                      </h4>
                                      <div className="flex gap-16 text-base font-normal">
                                        <div>
                                          {Array.from(
                                            new Set(
                                              popupDataMap[row.original.id].map(item =>
                                                new Date(item.date_from).toLocaleDateString("en-GB", {
                                                  year: "2-digit",
                                                  month: "2-digit",
                                                  day: "2-digit",
                                                })
                                              )
                                            )
                                          ).map((date, index) => (
                                            <div key={index} className="text-gray-500 py-2">
                                              {date}
                                            </div>
                                          ))}
                                        </div>

                                        <div>
                                          {popupDataMap[row.original.id].map(item => (
                                            <div key={item.id} className="flex gap-8 text-gray-500">
                                              <span className="py-2">
                                                {new Date(item.date_from).toLocaleTimeString("en-GB", {
                                                  timeZone: "UTC",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                  hour12: false,
                                                })}
                                              </span>
                                              <span className="py-2">
                                                {item.user_firstname} {item.user_lastname}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )}

                          {/* --- Technician Remarks --- */}
                          {activeSection === "remarks" && (
                            <>
                              {loadingMap[row.original.id] ? (
                                <tr>
                                  <td colSpan={row.cells.length} className="bg-gray-50 p-4 text-center">
                                    <div className="ml-2 space-y-2 p-2">
                                      <div className="h-6 bg-gray-200 rounded animate-pulse w-64"></div>
                                      <div className="h-6 bg-gray-200 rounded animate-pulse w-40"></div>
                                    </div>
                                  </td>
                                </tr>
                              ) : remarksDataMap[row.original.id]?.length > 0 && (
                                <tr>
                                  <td colSpan={row.cells.length} className="bg-gray-50 p-4">
                                    <div className="p-1">
                                      <table className="table-auto w-full text-base font-normal text-left border-collapse">
                                        <thead>
                                          <tr className="text-gray-700 border-b">
                                            <th className="pb-2">{t("work_order_list_table_page_remarks_ref")}</th>
                                            <th className="pb-2">{t("work_order_list_table_page_remarks_technician")}</th>
                                            <th className="pb-2">{t("work_order_list_table_page_remarks_date")}</th>
                                            <th className="pb-2">{t("work_order_list_table_page_remarks_technicians_remarks")}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {remarksDataMap[row.original.id].map(item => (
                                            <tr key={item.id} className="text-gray-500 border-b last:border-none">
                                              <td className="py-2 font-medium">{item.object_id2}</td>
                                              <td className="py-2">{item.user_fullname}</td>
                                              <td className="py-2 font-medium text-gray-700">
                                                {new Date(item.date_add).toLocaleDateString("en-GB", {
                                                  timeZone: "UTC",
                                                  year: "2-digit",
                                                  month: "2-digit",
                                                  day: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })}
                                              </td>
                                              <td className="py-2 w-1/2">{item.notes}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              {/* Skeleton inside the table: lines up with the columns and keeps the previous page's row count */}
              {isLoading && (
                <TableSkeletonRows rows={page.length} columns={columns.length} wideColumns={[2, 3]} />
              )}
              {!isLoading && jobs.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-6 text-center text-base text-slate-500">
                    {t("work_order_list_no_results")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between p-4">
            <span className="text-base text-slate-700">
              {t("work_order_list_table_pagination_page")} {pageIndex + 1} {t("work_order_list_table_pagination_of")} {pageCount}
            </span>
            <div>
              <button onClick={() => gotoPage(0)} disabled={!canPreviousPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowLeftToLine className="w-4" />
              </button>
              <button onClick={() => previousPage()} disabled={!canPreviousPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowLeft className="w-4" />
              </button>
              <button onClick={() => nextPage()} disabled={!canNextPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowRight className="w-4" />
              </button>
              <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage || isLoading} className="py-0.5 px-1 md:px-2 mr-1 text-primary rounded-md border border-primary disabled:opacity-50">
                <ArrowRightToLine className="w-4" />
              </button>
            </div>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="ml-1 p-1 md:p-1 text-base text-slate-700 border border-slate-700 rounded-md max-w-32">
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>
                  {t("work_order_list_table_pagination_show")} {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewWorkOrderList;