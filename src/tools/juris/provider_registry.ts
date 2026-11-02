// ============================================================================
// Registro e Roteador Jurisdicional Modular (docgov-engine v1.4.1)
// JurisdictionProviderRegistry Plug-and-Play com Graceful Fallback
// ============================================================================

import type {
  JurisdictionProvider,
  JurisdictionRoutingInfo,
} from "./types.ts";
import { TcuProvider } from "./providers/tcu_provider.ts";
import { StjProvider } from "./providers/stj_provider.ts";
import { StfProvider } from "./providers/stf_provider.ts";
import { TcePaProvider } from "./providers/tce_pa_provider.ts";
import { TceCeProvider } from "./providers/tce_ce_provider.ts";
import { TcdfProvider } from "./providers/tcdf_provider.ts";

export class JurisdictionProviderRegistry {
  private providers = new Map<string, JurisdictionProvider>();

  constructor() {
    this.register(new TcuProvider());
    this.register(new StjProvider());
    this.register(new StfProvider());
    this.register(new TcePaProvider());
    this.register(new TceCeProvider());
    this.register(new TcdfProvider());
  }

  public register(provider: JurisdictionProvider): void {
    this.providers.set(provider.courtId.toUpperCase(), provider);
  }

  public get(courtId: string): JurisdictionProvider | undefined {
    return this.providers.get(courtId.toUpperCase());
  }

  public getAllCourts(): string[] {
    return Array.from(this.providers.keys());
  }

  public getAllProviders(): JurisdictionProvider[] {
    return Array.from(this.providers.values());
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
   * Localiza conector estadual associado a uma UF.
   */
  public getProviderByUf(uf: string): JurisdictionProvider | undefined {
    const targetUf = uf.trim().toUpperCase();
    for (const prov of this.providers.values()) {
      if (prov.uf && prov.uf.toUpperCase() === targetUf) {
        return prov;
      }
      if (prov.courtId.toUpperCase() === `TCE-${targetUf}`) {
        return prov;
      }
      if (targetUf === "DF" && prov.courtId.toUpperCase() === "TCDF") {
        return prov;
      }
    }
    return undefined;
  }

  /**
   * Retorna os provedores federais padrão (defaultFederal !== false && tier === "FEDERAL").
   */
  public getDefaultFederalProviders(): JurisdictionProvider[] {
    const federal: JurisdictionProvider[] = [];
    for (const prov of this.providers.values()) {
      const isState =
        prov.tier === "STATE" ||
        !!prov.uf ||
        prov.courtId.startsWith("TCE-") ||
        prov.courtId.toUpperCase() === "TCDF";
      if (!isState && prov.defaultFederal !== false) {
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
      if (prov.uf && (upper.includes(`TCE-${prov.uf.toUpperCase()}`) || upper.includes(`TCE${prov.uf.toUpperCase()}`))) {
        return prov.courtId;
      }
    }

    // 2. Reconhecimento universal por regex de qualquer TCE estadual (ex.: TCE-SP, TCE-MG, etc.)
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
    requestedUf?: string
  ): {
    selectedProviders: JurisdictionProvider[];
    routingInfo: JurisdictionRoutingInfo;
  } {
    const executedCourts: string[] = [];
    const selected: JurisdictionProvider[] = [];
    let unimplementedUf: string | null = null;
    let fallbackNotice: string | null = null;

    const upperUf = requestedUf ? requestedUf.trim().toUpperCase() : undefined;
    const supportedUfs = this.getSupportedUfs();

    if (requestedCourts && requestedCourts.length > 0) {
      // 1. Cortes explícitas
      for (const courtName of requestedCourts) {
        const prov = this.get(courtName);
        if (prov && !selected.includes(prov)) {
          selected.push(prov);
          executedCourts.push(prov.courtId);
        }
      }
      if (upperUf) {
        const stateProv = this.getProviderByUf(upperUf);
        if (stateProv) {
          if (!selected.includes(stateProv)) {
            selected.push(stateProv);
            executedCourts.push(stateProv.courtId);
          }
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado na v1.4.1 (UFs nativas: ${supportedUfs.join(", ")}). Pesquisa executada nas cortes selecionadas via Graceful Fallback.`;
        }
      }
    } else {
      // 2. Sem cortes explícitas -> Camada federal padrão
      const federalProviders = this.getDefaultFederalProviders();
      for (const prov of federalProviders) {
        if (!selected.includes(prov)) {
          selected.push(prov);
          executedCourts.push(prov.courtId);
        }
      }

      if (upperUf) {
        const stateProv = this.getProviderByUf(upperUf);
        if (stateProv) {
          if (!selected.includes(stateProv)) {
            selected.push(stateProv);
            executedCourts.push(stateProv.courtId);
          }
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado na v1.4.1 (UFs nativas: ${supportedUfs.join(", ")}). Pesquisa executada automaticamente na camada federal (${executedCourts.join(", ")}) via Graceful Fallback.`;
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
