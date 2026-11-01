// ============================================================================
// Registro e Roteador Jurisdicional Modular (docgov-engine v1.4.0)
// JurisdictionProviderRegistry com Graceful Fallback e Suporte a Mock Server
// ============================================================================

import type {
  JurisdictionProvider,
  JurisdictionRoutingInfo,
} from "./types.ts";
import { TcuProvider } from "./providers/tcu_provider.ts";
import { StjProvider, StfProvider } from "./providers/higher_courts_provider.ts";
import {
  TcePaProvider,
  TceCeProvider,
  TcdfProvider,
} from "./providers/state_tces_provider.ts";

export const SUPPORTED_UFS = ["PA", "CE", "DF"] as const;

export const UF_TO_COURT_MAP: Record<string, string> = {
  PA: "TCE-PA",
  CE: "TCE-CE",
  DF: "TCDF",
};

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
        if (SUPPORTED_UFS.includes(upperUf as any)) {
          const stateCourt = UF_TO_COURT_MAP[upperUf];
          const prov = stateCourt ? this.get(stateCourt) : undefined;
          if (prov && !selected.includes(prov)) {
            selected.push(prov);
            executedCourts.push(prov.courtId);
          }
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado na v1.4.0 (UFs nativas: PA, CE, DF). Pesquisa executada nas cortes selecionadas via Graceful Fallback.`;
        }
      }
    } else {
      // 2. Sem cortes explícitas -> Roteamento padrão
      const federalCourts = ["TCU", "STJ", "STF"];
      for (const fCourt of federalCourts) {
        const prov = this.get(fCourt);
        if (prov) {
          selected.push(prov);
          executedCourts.push(prov.courtId);
        }
      }

      if (upperUf) {
        if (SUPPORTED_UFS.includes(upperUf as any)) {
          const stateCourt = UF_TO_COURT_MAP[upperUf];
          const prov = stateCourt ? this.get(stateCourt) : undefined;
          if (prov && !selected.includes(prov)) {
            selected.push(prov);
            executedCourts.push(prov.courtId);
          }
        } else {
          unimplementedUf = upperUf;
          fallbackNotice = `Conector estadual para UF '${upperUf}' ainda não implementado na v1.4.0 (UFs nativas: PA, CE, DF). Pesquisa executada automaticamente na camada federal (TCU, STJ, STF) via Graceful Fallback.`;
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
      supported_ufs: Array.from(SUPPORTED_UFS),
      fallback_notice: fallbackNotice,
    };

    return {
      selectedProviders: selected,
      routingInfo,
    };
  }
}

export const defaultJurisdictionRegistry = new JurisdictionProviderRegistry();
