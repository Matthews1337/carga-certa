import type { LeituraDePosicao } from '@carga-certa/shared';

/**
 * Localizacao pelo navegador.
 *
 * No celular vem do GPS; no notebook, das redes Wi-Fi por perto; no computador
 * no cabo, do endereco da internet - por isso toda leitura traz a precisao, e
 * quem grava decide com `precisaoAceitavel` (shared).
 *
 * Limite que nao tem como contornar num site: com a tela bloqueada ou o
 * navegador em segundo plano, o iPhone e o Android param de entregar posicao.
 * Gravar o trajeto com o celular no bolso fica para o app instalado.
 */

export class ErroDeLocalizacao extends Error {
  /** Sem permissao, insistir nao adianta: quem grava o trajeto desliga. */
  readonly semPermissao: boolean;

  constructor(mensagem: string, semPermissao = false) {
    super(mensagem);
    this.semPermissao = semPermissao;
  }
}

const OPCOES: PositionOptions = {
  enableHighAccuracy: true,
  // GPS frio, dentro da cabine, pode levar uns segundos para a primeira leitura.
  timeout: 20_000,
};

function paraLeitura(p: GeolocationPosition): LeituraDePosicao {
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    precisaoM: p.coords.accuracy,
    em: p.timestamp,
  };
}

function traduzir(erro: GeolocationPositionError): ErroDeLocalizacao {
  if (erro.code === erro.PERMISSION_DENIED) {
    return new ErroDeLocalizacao(
      'O navegador não tem permissão para usar a localização. No iPhone, libere em Ajustes → ' +
        'Privacidade e Segurança → Serviços de Localização → Sites do Safari; nos outros, no ' +
        'cadeado ao lado do endereço do site.',
      true,
    );
  }
  if (erro.code === erro.TIMEOUT) {
    return new ErroDeLocalizacao(
      'O GPS demorou para responder. Tente de novo, de preferência com o céu à vista.',
    );
  }
  return new ErroDeLocalizacao(
    'Não foi possível saber onde você está. Confira se a localização do aparelho está ligada.',
  );
}

function geolocalizacao(): Geolocation {
  // Fora de HTTPS o navegador nem oferece a API. A Netlify e o localhost sao
  // contextos seguros; um IP da rede local (192.168...) nao e.
  if (!('geolocation' in navigator) || !window.isSecureContext) {
    throw new ErroDeLocalizacao('Este navegador não informa a localização.');
  }
  return navigator.geolocation;
}

/** Uma leitura. Rejeita com ErroDeLocalizacao, ja em portugues. */
export function lerPosicao(): Promise<LeituraDePosicao> {
  return new Promise((resolve, reject) => {
    try {
      geolocalizacao().getCurrentPosition(
        (p) => resolve(paraLeitura(p)),
        (e) => reject(traduzir(e)),
        // Uma leitura de ate 15 s atras serve: evita esperar o GPS de novo
        // quando a pessoa toca duas vezes seguidas.
        { ...OPCOES, maximumAge: 15_000 },
      );
    } catch (erro) {
      reject(erro);
    }
  });
}

/** Acompanha a posicao ate a funcao devolvida ser chamada. */
export function observarPosicao(
  aoLer: (leitura: LeituraDePosicao) => void,
  aoFalhar: (erro: ErroDeLocalizacao) => void,
): () => void {
  let id: number;
  try {
    id = geolocalizacao().watchPosition(
      (p) => aoLer(paraLeitura(p)),
      (e) => aoFalhar(traduzir(e)),
      { ...OPCOES, maximumAge: 0 },
    );
  } catch (erro) {
    aoFalhar(erro as ErroDeLocalizacao);
    return () => {};
  }
  return () => navigator.geolocation.clearWatch(id);
}

/**
 * Pede para a tela nao apagar enquanto o trajeto e gravado: apagada, o
 * navegador para de receber o GPS. O pedido cai sozinho quando a pagina sai
 * da frente, e volta quando ela reaparece. Navegador sem a API: segue sem.
 */
export function manterTelaAcesa(): () => void {
  if (!('wakeLock' in navigator)) return () => {};

  let ativo = true;
  let trava: WakeLockSentinel | null = null;

  const pedir = async () => {
    if (!ativo || document.visibilityState !== 'visible') return;
    try {
      trava = await navigator.wakeLock.request('screen');
    } catch {
      // Bateria fraca ou economia de energia: o sistema pode recusar.
    }
  };
  const aoVoltar = () => void pedir();

  void pedir();
  document.addEventListener('visibilitychange', aoVoltar);

  return () => {
    ativo = false;
    document.removeEventListener('visibilitychange', aoVoltar);
    void trava?.release().catch(() => {});
    trava = null;
  };
}
