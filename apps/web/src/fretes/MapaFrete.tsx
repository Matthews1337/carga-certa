import { dividirRota, type Ponto } from '@carga-certa/shared';
import type { GeoJSONSource, Map as MapaMapLibre, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { Carregando } from '@/components/ui/feedback';
import { CORES_DO_MAPA, ESTILO_DO_MAPA } from '@/lib/mapa';
import type { Coordenada } from '@/lib/rotas';
import { cn } from '@/lib/utils';
import { useTema } from '@/tema/TemaProvider';

/**
 * Mapa de verdade (MapLibre + OpenFreeMap), para o detalhe e o formulario do
 * frete. Um por vez na tela - os cards usam o MiniMapa em SVG.
 *
 * O MapLibre (~800 kB) e importado na hora em que o mapa monta: quem so olha a
 * lista de fretes nao baixa. O pedaco e separado no vite.config.ts.
 */

type Qual = 'origem' | 'destino';

const CENTRO_DO_BRASIL: [number, number] = [-51.9, -14.2];
const ID_ROTA = 'rota';

const TEXTOS_DO_MAPA = {
  'Map.Title': 'Mapa',
  'Marker.Title': 'Marcador',
  'NavigationControl.ZoomIn': 'Aproximar',
  'NavigationControl.ZoomOut': 'Afastar',
  'NavigationControl.ResetBearing': 'Voltar o norte para cima',
  'AttributionControl.ToggleAttribution': 'Mostrar créditos do mapa',
};

const NOME_DO_PINO: Record<Qual, string> = {
  origem: 'Início do frete',
  destino: 'Fim do frete',
};

export function MapaFrete({
  origem,
  destino,
  rota,
  posicao,
  aoClicar,
  aoArrastar,
  className,
}: {
  origem: Coordenada | null;
  destino: Coordenada | null;
  rota: Ponto[] | null;
  posicao: Coordenada | null;
  /** Presente = o clique marca um ponto. */
  aoClicar?: (ponto: Coordenada) => void;
  /** Presente = os pinos de inicio e fim podem ser arrastados. */
  aoArrastar?: (qual: Qual, ponto: Coordenada) => void;
  className?: string;
}) {
  const { resolvido } = useTema();
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMapLibre | null>(null);
  const construtorMarcador = useRef<typeof Marker | null>(null);
  const marcadores = useRef<Partial<Record<Qual | 'posicao', Marker>>>({});
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Callbacks mudam a cada render do pai; o mapa guarda a versao mais nova
  // sem precisar desligar e religar os eventos.
  const callbacks = useRef({ aoClicar, aoArrastar });
  callbacks.current = { aoClicar, aoArrastar };

  // Cria o mapa. Trocar de tema recria: setStyle apagaria a camada da rota.
  useEffect(() => {
    let cancelado = false;
    let instancia: MapaMapLibre | null = null;

    void (async () => {
      // O CSS vem junto, e nao num import estatico no topo do arquivo: o CSS
      // cai no mesmo pedaco do MapLibre, e o import estatico fazia a LISTA de
      // fretes baixar os 285 kB do mapa so para ter o estilo.
      const [{ default: maplibre }] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      if (cancelado || !container.current) return;

      instancia = new maplibre.Map({
        container: container.current,
        style: ESTILO_DO_MAPA[resolvido],
        center: CENTRO_DO_BRASIL,
        zoom: 3.2,
        attributionControl: { compact: true },
        // O MapLibre fala ingles com o leitor de tela ("Zoom in", "Map").
        locale: TEXTOS_DO_MAPA,
      });
      instancia.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      construtorMarcador.current = maplibre.Marker;

      instancia.on('load', () => {
        instancia?.addSource(ID_ROTA, { type: 'geojson', data: colecaoVazia() });
        instancia?.addLayer({
          id: ID_ROTA,
          type: 'line',
          source: ID_ROTA,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['match', ['get', 'trecho'], 'percorrido', CORES_DO_MAPA.motorista, CORES_DO_MAPA.restante],
            'line-width': ['match', ['get', 'trecho'], 'percorrido', 5, 4],
            // Reta entre os pinos quando a rota nao foi calculada.
            'line-dasharray': ['match', ['get', 'trecho'], 'reta', ['literal', [2, 2]], ['literal', [1, 0]]],
          },
        });
        mapa.current = instancia;
        setPronto(true);
      });
      instancia.on('click', (e) => callbacks.current.aoClicar?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      instancia.on('error', (e) => {
        // Tile que falha sozinho nao derruba o mapa; so o estilo importa.
        if (!instancia?.isStyleLoaded()) setErro('Não foi possível carregar o mapa. Confira a conexão.');
        console.warn('MapLibre:', e.error?.message);
      });
    })().catch(() => setErro('Não foi possível carregar o mapa.'));

    return () => {
      cancelado = true;
      setPronto(false);
      marcadores.current = {};
      mapa.current = null;
      instancia?.remove();
    };
  }, [resolvido]);

  // Desenha rota e pinos, e enquadra.
  useEffect(() => {
    const m = mapa.current;
    const Marcador = construtorMarcador.current;
    if (!pronto || !m || !Marcador) return;

    // Erro dentro de um efeito derruba a arvore inteira do React - o
    // formulario sumiria junto com o mapa. Falha de desenho vira aviso.
    try {
      desenhar({
        mapa: m,
        Marcador,
        marcadores: marcadores.current,
        aoArrastar: callbacks.current.aoArrastar
          ? (qual, ponto) => callbacks.current.aoArrastar?.(qual, ponto)
          : undefined,
        origem,
        destino,
        rota,
        posicao,
      });
    } catch (e) {
      console.error('MapaFrete:', e);
      setErro('Não foi possível desenhar a rota no mapa.');
    }
  }, [pronto, origem, destino, rota, posicao]);

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border bg-muted', className)}>
      {/* O container do MapLibre fica DENTRO de uma caixa absoluta, e nao e
          ele a caixa: o CSS do MapLibre poe `position: relative` na classe
          .maplibregl-map, anula o `absolute` e o mapa fica com altura zero. */}
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>
      {!pronto && !erro ? (
        <div className="absolute inset-0">
          <Carregando texto="Carregando o mapa..." />
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-sm text-muted-foreground">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function desenhar({
  mapa: m,
  Marcador,
  marcadores,
  aoArrastar,
  origem,
  destino,
  rota,
  posicao,
}: {
  mapa: MapaMapLibre;
  Marcador: typeof Marker;
  marcadores: Partial<Record<Qual | 'posicao', Marker>>;
  aoArrastar: ((qual: Qual, ponto: Coordenada) => void) | undefined;
  origem: Coordenada | null;
  destino: Coordenada | null;
  rota: Ponto[] | null;
  posicao: Coordenada | null;
}): void {
  const dividida = posicao && rota && rota.length >= 2 ? dividirRota(rota, [posicao.lat, posicao.lng]) : null;
  const trechos: { trecho: string; pontos: Ponto[] }[] = [];
  if (rota && rota.length >= 2) {
    if (dividida) {
      trechos.push({ trecho: 'percorrido', pontos: dividida.percorrido });
      trechos.push({ trecho: 'restante', pontos: dividida.restante });
    } else {
      trechos.push({ trecho: 'restante', pontos: rota });
    }
  } else if (origem && destino) {
    trechos.push({ trecho: 'reta', pontos: [[origem.lat, origem.lng], [destino.lat, destino.lng]] });
  }
  (m.getSource(ID_ROTA) as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: trechos.map(({ trecho, pontos }) => ({
      type: 'Feature',
      properties: { trecho },
      // GeoJSON e [longitude, latitude].
      geometry: { type: 'LineString', coordinates: pontos.map(([lat, lng]) => [lng, lat]) },
    })),
  });

  const posicionar = (qual: Qual | 'posicao', ponto: Coordenada | null, criar: () => Marker) => {
    const atual = marcadores[qual];
    if (!ponto) {
      atual?.remove();
      delete marcadores[qual];
      return;
    }
    // Coordenada ANTES do addTo: o MapLibre nao aceita marcador sem posicao.
    const marcador = atual ?? criar();
    marcador.setLngLat([ponto.lng, ponto.lat]);
    if (!atual) marcador.addTo(m);
    marcadores[qual] = marcador;
  };

  const pino = (qual: Qual, cor: string) => () => {
    const marcador = new Marcador({ color: cor, draggable: Boolean(aoArrastar) });
    marcador.getElement().setAttribute('aria-label', NOME_DO_PINO[qual]);
    marcador.on('dragend', () => {
      const { lat, lng } = marcador.getLngLat();
      aoArrastar?.(qual, { lat, lng });
    });
    return marcador;
  };
  posicionar('origem', origem, pino('origem', CORES_DO_MAPA.inicio));
  posicionar('destino', destino, pino('destino', CORES_DO_MAPA.fim));
  posicionar('posicao', posicao, () => new Marcador({ element: elementoDoMotorista() }));

  // Enquadra tudo o que esta desenhado.
  const pontos: [number, number][] = [
    ...trechos.flatMap((t) => t.pontos.map(([lat, lng]) => [lng, lat] as [number, number])),
    ...[origem, destino, posicao].flatMap((p) => (p ? [[p.lng, p.lat] as [number, number]] : [])),
  ];
  if (pontos.length === 1) {
    m.easeTo({ center: pontos[0], zoom: Math.max(m.getZoom(), 9) });
  } else if (pontos.length > 1) {
    const lngs = pontos.map((p) => p[0]);
    const lats = pontos.map((p) => p[1]);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 12, duration: 400 },
    );
  }
}

function colecaoVazia() {
  return { type: 'FeatureCollection' as const, features: [] };
}

/** Bolinha ambar com borda branca: o motorista, diferente dos pinos de inicio e fim. */
function elementoDoMotorista(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'Última posição do motorista');
  el.style.cssText =
    `width:18px;height:18px;border-radius:9999px;background:${CORES_DO_MAPA.motorista};` +
    'border:3px solid white;box-shadow:0 0 0 2px rgba(0,0,0,.25)';
  return el;
}
