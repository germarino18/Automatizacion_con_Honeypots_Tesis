const API_BASE = '/api/v1';
const LOGIN_PATH = '/login';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

function redirectToLogin(): void {
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
    window.location.assign(LOGIN_PATH);
  }
}

export type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions extends RequestInit {
  authRedirect?: boolean;
}

function toQueryString(params: object = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { headers, body, authRedirect = true, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body,
    });
  } catch (error) {
    throw new ApiError(0, 'No se pudo conectar con la API', {
      cause: error,
    });
  }

  if (response.status === 401) {
    if (authRedirect) {
      redirectToLogin();
    }
    throw new ApiError(401, 'Sesión no válida o expirada');
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Error HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(
  path: string,
  params?: object,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>(`${path}${toQueryString(params)}`, options);
}

export async function apiPost<T>(
  path: string,
  payload?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: 'POST',
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
}

export async function login(
  username: string,
  password: string,
  options: RequestOptions = {},
) {
  return apiPost<LoginResponse>('/auth/login', { username, password }, options);
}

export async function logout(options: RequestOptions = {}) {
  return apiPost<LogoutResponse>('/auth/logout', undefined, options);
}

/* ---- Tipos espejo de los DTOs Pydantic de la API (api/app/schemas/) ---- */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface LoginResponse {
  user: string;
  expires_in: number;
  token: string | null;
}

export interface LogoutResponse {
  message: string;
}

export interface HealthResponse {
  status: string;
  api: string;
  postgres: string;
}

export interface ServiceHealth {
  status: string;
  detail?: string | null;
}

export interface ServicesHealthResponse {
  status: string;
  services: Record<string, ServiceHealth>;
}

export interface HoneypotCount {
  source_honeypot: string;
  count: number;
}

export interface TopIp {
  src_ip: string;
  total_ataques: number;
  tecnicas_usadas?: number;
  max_riesgo?: number | null;
  riesgo_promedio?: number | null;
  primer_ataque?: string | null;
  ultimo_ataque?: string | null;
}

export interface CriticalAlert {
  id: number;
  timestamp: string;
  source_honeypot: string;
  src_ip: string;
  att_ck_technique?: string | null;
  risk_score?: number | null;
  severity: Severity;
}

export interface Overview {
  total_eventos: number;
  ips_unicas: number;
  eventos_por_honeypot: HoneypotCount[];
  top_ips: TopIp[];
  alertas_criticas: CriticalAlert[];
  total_malware: number;
  mttd_seconds?: number | null;
  mttr_seconds?: number | null;
}

export interface EventFilters {
  from?: string;
  to?: string;
  source_honeypot?: string;
  protocol?: string;
  src_ip?: string;
  severity?: Severity;
  technique?: string;
  username?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface EventItem {
  id: number;
  timestamp: string;
  source_honeypot: string;
  src_ip: string;
  dst_port?: number | null;
  protocol?: string | null;
  username?: string | null;
  commands?: string | null;
  malware_hash?: string | null;
  malware_filename?: string | null;
  playbook_id?: string | null;
  risk_score?: number | null;
  att_ck_technique?: string | null;
  severity: Severity;
  enrichment_data?: Record<string, unknown> | null;
  raw_data?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface EventPage {
  items: EventItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResponseItem {
  id: number;
  event_id?: number | null;
  timestamp?: string | null;
  action_type: string;
  actor?: string | null;
  status?: string | null;
  evidence_uri?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface EventDetail extends EventItem {
  responses: ResponseItem[];
}

export interface TechniqueCount {
  technique: string;
  tactic?: string | null;
  name?: string | null;
  count: number;
}

export interface MitreResponse {
  techniques: TechniqueCount[];
  total: number;
}

export interface CountryCount {
  country: string;
  count: number;
}

export interface GeoResponse {
  countries: CountryCount[];
  total: number;
  fallback_used: boolean;
}

export interface MalwareItem {
  malware_hash: string;
  count: number;
  filenames: string[];
  src_ips: string[];
  first_seen?: string | null;
  last_seen?: string | null;
}

export interface MalwareResponse {
  items: MalwareItem[];
  total: number;
}

export interface IocFilters {
  ioc_type?: string;
  severity?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface IocItem {
  id: number;
  ioc_type: string;
  ioc_value: string;
  first_seen?: string | null;
  last_seen?: string | null;
  source?: string | null;
  severity?: string | null;
  tags: string[];
  notes?: string | null;
}

export interface IocPage {
  items: IocItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkflowItem {
  id: number | string;
  name: string;
  active: boolean;
}

export interface WorkflowsResponse {
  degraded: boolean;
  message?: string | null;
  items: WorkflowItem[];
}

export interface ExecutionItem {
  id: number | string;
  workflowId?: number | string | null;
  status?: string | null;
  startedAt?: string | null;
}

export interface ExecutionsResponse {
  degraded: boolean;
  message?: string | null;
  items: ExecutionItem[];
}

export interface AutomationResponsesFilters {
  action_type?: string;
  status?: string;
  event_id?: number;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface ResponsePage {
  items: ResponseItem[];
  total: number;
  page: number;
  page_size: number;
}

/* Acciones SOAR (espejo de api/app/schemas/automation.py) */

export interface SimulateResponse {
  success: boolean;
  honeypot: string;
  result: Record<string, unknown>;
}

export interface BlockIpResponse {
  success: boolean;
  src_ip: string;
  result: Record<string, unknown>;
}

export interface CreateTicketResponse {
  success: boolean;
  result: Record<string, unknown>;
}
