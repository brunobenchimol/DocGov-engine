// ============================================================================
// Registro e Roteador Jurisdicional Modular (docgov-engine v1.4.1)
// JurisdictionProviderRegistry Plug-and-Play com Graceful Fallback
// ============================================================================

import type {
  JurisdictionProvider,
  JurisdictionRoutingInfo,
  JurisdictionSphere,
} from "./types.ts";
import { TcuProvider } from "./providers/tcu_provider.ts";
import { StjProvider } from "./providers/stj_provider.ts";
import { StfProvider } from "./providers/stf_provider.ts";
import { TcePaProvider } from "./providers/tce_pa_provider.ts";
import { TcmPaProvider } from "./providers/tcm_pa_provider.ts";
import { TceCeProvider } from "./providers/tce_ce_provider.ts";
import { TcdfProvider } from "./providers/tcdf_provider.ts";
import { TceSpProvider } from "./providers/tce_sp_provider.ts";
import { TceMgProvider } from "./providers/tce_mg_provider.ts";
import { TcePrProvider } from "./providers/tce_pr_provider.ts";
import { TstProvider } from "./providers/tst_provider.ts";
import { AguProvider } from "./providers/agu_provider.ts";

export class JurisdictionProviderRegistry {
  private providers = new Map<string, JurisdictionProvider>();

  constructor() {
    this.register(new TcuProvider());
    this.register(new StjProvider());
    this.register(new StfProvider());
    this.register(new TstProvider());
    this.register(new AguProvider());
    this.register(new TcePaProvider());
    this.register(new TcmPaProvider());
    this.register(new TceCeProvider());
    this.register(new TcdfProvider());
    this.register(new TceSpProvider());
    this.register(new TceMgProvider());
    this.register(new TcePrProvider());
  }

  public register(provider: JurisdictionProvider): void {
    this.providers.set(provider.courtId.toUpperCase(), provider);
  }

  public get(courtId: string): JurisdictionProvider | undefined {
    const upper = courtId.trim().toUpperCase();
    const direct = this.providers.get(upper);
    if (direct) return direct;

    // Normaliza variações sem hífen ou com underscore (ex.: TCMPA, TCM_PA -> TCM-PA)
    const compact = upper.replace(/[-_\s]+/g, "");
    for (const [key, prov] of this.providers.entries()) {
      if (key.replace(/[-_\s]+/g, "") === compact) {
        return prov;
      }
    }
    return undefined;
  }

  public getAllCourts(): string[] {
    return Array.from(this.providers.keys());
  }

  public getAllProviders(): JurisdictionProvider[] {
    return Array.from(this.providers.values());
  }

  public resetAllCircuits(): void {
    for (const prov of this.providers.values()) {
      prov.resetCircuit?.();
    }
  }

  /**
   * Deriva dinamicamente a lista de UFs suportadas a partir dos conectores registrados.
   */
  public getSupportedUfs(): string[] {
    const ufs = new Set<string>();
    for (const prov of this.providers.values()) {
      if (prov.uf) {
        ufs.add(prov.uf.toUpperCase());
      } else {
        // Fallback por convenção de nomenclatura (ex: TCE-PA -> PA, TCDF -> DF)
        const m = prov.courtId.match(/^TCE-([A-Z]{2})$/i);
        if (m) ufs.add(m[1].toUpperCase());
        if (prov.courtId.toUpperCase() === "TCDF") ufs.add("DF");
      }
    }
    return Array.from(ufs);
  }

  /**
   * Localiza conector subnacional associado a uma UF, respeitando a esfera solicitada.
   * Por padrão ("STATE"), prioriza TCE-<UF>/TCDF para retrocompatibilidade com a Onda 1/2.
   */
  public getProviderByUf(
    uf: string,
    sphere: "STATE" | "MUNICIPAL" = "STATE"
  ): JurisdictionProvider | undefined {
    const targetUf = uf.trim().toUpperCase();
    const candidates = Array.from(this.providers.values()).filter((prov) => {
      if (prov.uf && prov.uf.toUpperCase() === targetUf) return true;
      if (prov.courtId.toUpperCase() === `TCE-${targetUf}`) return true;
      if (prov.courtId.toUpperCase() === `TCM-${targetUf}`) return true;
      if (targetUf === "DF" && prov.courtId.toUpperCase() === "TCDF") return true;
      return false;
    });

    if (candidates.length === 0) return undefined;

    if (sphere === "MUNICIPAL") {
      return candidates.find(
        (p) => p.tier === "MUNICIPAL" || p.courtId.toUpperCase().startsWith("TCM-")
      );
    }

    return (
      candidates.find(
        (p) => p.tier !== "MUNICIPAL" && !p.courtId.toUpperCase().startsWith("TCM-")
      ) || candidates[0]
    );
  }

  /**
   * Retorna todos os conectores subnacionais aplicáveis a uma UF segundo a esfera ("STATE" | "MUNICIPAL" | "ALL").
   */
  public getProvidersByUf(
    uf: string,
    sphere: JurisdictionSphere = "STATE"
  ): JurisdictionProvider[] {
    const targetUf = uf.trim().toUpperCase();
    if (sphere === "ALL") {
      return Array.from(this.providers.values()).filter((prov) => {
        if (prov.uf && prov.uf.toUpperCase() === targetUf) return true;
        if (prov.courtId.toUpperCase() === `TCE-${targetUf}`) return true;
        if (prov.courtId.toUpperCase() === `TCM-${targetUf}`) return true;
        if (targetUf === "DF" && prov.courtId.toUpperCase() === "TCDF") return true;
        return false;
      });
    }
    const single = this.getProviderByUf(targetUf, sphere);
    return single ? [single] : [];
  }

  /**
   * Retorna os provedores federais padrão (defaultFederal !== false && tier === "FEDERAL").
   */
  public getDefaultFederalProviders(): JurisdictionProvider[] {
    const federal: JurisdictionProvider[] = [];
    for (const prov of this.providers.values()) {
      const isSubnational =
        prov.tier === "STATE" ||
        prov.tier === "MUNICIPAL" ||
        !!prov.uf ||
        prov.courtId.startsWith("TCE-") ||
        prov.courtId.startsWith("TCM-") ||
        prov.courtId.toUpperCase() === "TCDF";
      if (!isSubnational && prov.defaultFederal !== false) {
        federal.push(prov);
      }
    }
    return federal.length > 0 ? federal : [this.get("TCU")!].filter(Boolean);
  }

  /**
   * Detecta a corte a partir de qualquer identificador ou URL de acórdão,
   * consultando primeiramente os idPatterns de cada provider registrado.
   */
  public detectCourtFromRef(ref: string): string {
    if (!ref) return "TCU";
    const cleanRef = ref.trim();
    const upper = cleanRef.toUpperCase();

    // 1. Consulta idPatterns e courtId de cada provedor registrado
    for (const prov of this.providers.values()) {
      if (prov.idPatterns && prov.idPatterns.some((pattern) => pattern.test(cleanRef))) {
        return prov.courtId;
      }
      if (upper.includes(prov.courtId.toUpperCase())) {
        return prov.courtId;
      }
      if (prov.uf) {
        const ufUpper = prov.uf.toUpperCase();
        const isMunicipal = prov.tier === "MUNICIPAL" || prov.courtId.toUpperCase().startsWith("TCM-");
        if (isMunicipal && (upper.includes(`TCM-${ufUpper}`) || upper.includes(`TCM${ufUpper}`))) {
          return prov.courtId;
        }
        if (!isMunicipal && (upper.includes(`TCE-${ufUpper}`) || upper.includes(`TCE${ufUpper}`))) {
          return prov.courtId;
        }
      }
    }

    // 2. Reconhecimento universal por regex de TCM municipal e TCE estadual
    const tcmMatch = upper.match(/\bTCM[-_]?([A-Z]{2,3})\b/);
    if (tcmMatch) {
      const candidateCourt = `TCM-${tcmMatch[1]}`;
      const existing = this.get(candidateCourt);
      return existing ? existing.courtId : candidateCourt;
    }

    const tceMatch = upper.match(/\bTCE[-_]?([A-Z]{2})\b/);
    if (tceMatch) {
      const candidateCourt = `TCE-${tceMatch[1]}`;
      if (this.providers.has(candidateCourt.toUpperCase())) {
        return this.providers.get(candidateCourt.toUpperCase())!.courtId;
      }
      return candidateCourt;
    }

    // 3. Cortes federais comuns
    if (/\bTCDF\b/.test(upper)) return "TCDF";
    if (/\bSTJ\b/.test(upper)) return "STJ";
    if (/\bSTF\b/.test(upper)) return "STF";
    if (/\bTST\b/.test(upper)) return "TST";
    if (/\b(AGU|CGU)\b/.test(upper)) return "AGU";

    return "TCU";
  }

  /**
   * Resolve a rota jurisdicional com base em courts e uf solicitados,
   * aplicando degradação graciosa (Graceful Fallback) se a UF não estiver implementada.
   */
  public resolveRouting(
    requestedCourts?: string[],
    requestedUf?: string,
    queryContext?: string,
    requestedSphere?: JurisdictionSphere
  ): {
    selectedProviders: JurisdictionProvider[];
    routingInfo: JurisdictionRoutingInfo;
  } {
    const executedCourts: string[] = [];
    const selected: JurisdictionProvider[] = [];
    let unimplementedUf: string | null = null;
    let fallbackNotice: string | null = null;

    const upperUf = requestedUf ? requestedUf.trim().toUpperCase() : undefined;
    const sphere: JurisdictionSphere = requestedSphere || "STATE";
    const supportedUfs = this.getSupportedUfs();

    const addSelected = (prov: JurisdictionProvider) => {
      if (!selected.includes(prov)) {
        selected.push(prov);
        executedCourts.push(prov.courtId);
      }
    };

    const resolveUfOrDirectCourt = (ufOrCourt: string): JurisdictionProvider[] => {
      const direct = this.get(ufOrCourt);
      if (direct) return [direct];
      return this.getProvidersByUf(ufOrCourt, sphere);
    };

    if (requestedCourts && requestedCourts.length > 0) {
      // 1. Cortes explícitas
      for (const courtName of requestedCourts) {
        const prov = this.get(courtName);
        if (prov) addSelected(prov);
      }
      if (upperUf) {
        const ufProvs = resolveUfOrDirectCourt(upperUf);
        if (ufProvs.length > 0) {
          ufProvs.forEach(addSelected);
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado (UFs nativas: ${supportedUfs.join(", ")}). Pesquisa executada nas cortes selecionadas via Graceful Fallback.`;
        }
      }
    } else {
      // 2. Sem cortes explícitas -> Camada federal padrão (escolha adicional pertence ao cognitivo)
      const federalProviders = this.getDefaultFederalProviders();
      federalProviders.forEach(addSelected);

      if (upperUf) {
        const ufProvs = resolveUfOrDirectCourt(upperUf);
        if (ufProvs.length > 0) {
          ufProvs.forEach(addSelected);
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado (UFs nativas: ${supportedUfs.join(", ")}). Pesquisa executada automaticamente na camada federal (${executedCourts.join(", ")}) via Graceful Fallback.`;
        }
      }
    }

    // Se por qualquer motivo não houver nenhum selecionado, fallback para TCU
    if (selected.length === 0) {
      const tcu = this.get("TCU");
      if (tcu) {
        selected.push(tcu);
        executedCourts.push(tcu.courtId);
      }
    }

    const routingInfo: JurisdictionRoutingInfo = {
      executed_courts: executedCourts,
      unimplemented_uf_requested: unimplementedUf,
      supported_ufs: supportedUfs,
      fallback_notice: fallbackNotice,
    };

    return {
      selectedProviders: selected,
      routingInfo,
    };
  }
}

export const defaultJurisdictionRegistry = new JurisdictionProviderRegistry();

// Exportações retrocompatíveis para consumo de testes e utilitários
export const SUPPORTED_UFS = new Proxy([] as string[], {
  get(_target, prop) {
    const list = defaultJurisdictionRegistry.getSupportedUfs();
    if (prop === "length") return list.length;
    if (prop === "includes") return (val: string) => list.includes(val);
    if (typeof prop === "string" && !isNaN(Number(prop))) return list[Number(prop)];
    // @ts-ignore
    return list[prop];
  },
});

export const UF_TO_COURT_MAP = new Proxy({} as Record<string, string>, {
  get(_target, prop) {
    if (typeof prop === "string") {
      const prov = defaultJurisdictionRegistry.getProviderByUf(prop);
      return prov ? prov.courtId : undefined;
    }
    return undefined;
  },
});
