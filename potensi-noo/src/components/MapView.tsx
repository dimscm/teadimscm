import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import Supercluster from 'supercluster'
import { useApp } from '../state/AppState'
import { DIVISIONS, DIVISION_COLORS, DIVISION_INITIALS, NO_DIVISION, OMZET_STEPS, STATUS_COLOURS, UNKNOWN_COLOR } from '../types'

/** Colour of one outlet under the active colour mode. */
function pinColour(mode: string, division: number, marked: number, omzet: number): string {
  if (mode === 'status') return marked ? STATUS_COLOURS.marked : STATUS_COLOURS.covered
  if (mode === 'omzet') return (OMZET_STEPS.find((step) => omzet < step.limit) ?? OMZET_STEPS[OMZET_STEPS.length - 1]).colour
  return division === NO_DIVISION ? UNKNOWN_COLOR : DIVISION_COLORS[DIVISIONS[division]]
}

/** Readable text colour on top of a filled circle. */
function inkOn(colour: string): string {
  const hex = colour.replace('#', '')
  const value = parseInt(hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex, 16)
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255
  return luminance > 0.62 ? '#0f172a' : '#ffffff'
}

interface PointProps {
  row: number
  marked: number
  division: number
  omzet: number
}

interface ClusterProps {
  marked: number
  /** Points per division, so a bubble can show what it is made of. */
  perDivision: number[]
}

/** Zoom at which single outlets get their division letter drawn on top. */
const LETTER_ZOOM = 17

export default function MapView() {
  const { data, result, reference, setReference, selected, setSelected, preferences, fitToken } = useApp()
  const mode = preferences.colourMode
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const canvas = useRef<L.Canvas | null>(null)
  const markerLayer = useRef<L.LayerGroup | null>(null)
  const letterLayer = useRef<L.LayerGroup | null>(null)
  const referenceLayer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const lastFit = useRef(-1)

  const index = useMemo(() => {
    if (!data) return null
    const features: GeoJSON.Feature<GeoJSON.Point, PointProps>[] = []
    for (let i = 0; i < result.count; i += 1) {
      const row = result.rows[i]
      if (data.positionSource[row] === 0) continue
      features.push({
        type: 'Feature',
        properties: { row, marked: result.marked[i], division: data.division[row], omzet: result.omzet[i] },
        geometry: { type: 'Point', coordinates: [data.lng[row], data.lat[row]] },
      })
    }
    const cluster = new Supercluster<PointProps, ClusterProps>({
      radius: 62,
      maxZoom: 16,
      minPoints: 4,
      map: (props) => {
        const perDivision = [0, 0, 0, 0, 0, 0]
        perDivision[props.division === NO_DIVISION ? DIVISIONS.length : props.division] = 1
        return { marked: props.marked, perDivision }
      },
      reduce: (accumulated, props) => {
        accumulated.marked += props.marked
        for (let i = 0; i < accumulated.perDivision.length; i += 1) accumulated.perDivision[i] += props.perDivision[i]
      },
    })
    cluster.load(features)
    return cluster
  }, [data, result])

  useEffect(() => {
    if (map.current || !container.current) return
    const instance = L.map(container.current, {
      center: [-6.186, 106.906],
      zoom: 12,
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(instance)
    L.control.zoom({ position: 'topright' }).addTo(instance)

    canvas.current = L.canvas({ padding: 0.3 })
    markerLayer.current = L.layerGroup().addTo(instance)
    letterLayer.current = L.layerGroup().addTo(instance)
    referenceLayer.current = L.layerGroup().addTo(instance)

    instance.on('click', (event: L.LeafletMouseEvent) => {
      setReference({ lat: event.latlng.lat, lng: event.latlng.lng, label: 'Titik pilihan di peta', source: 'map' })
    })

    // The map is created before flexbox has given the container its height,
    // so Leaflet's cached size would be wrong — and every fitBounds and click
    // with it.
    const resize = new ResizeObserver(() => instance.invalidateSize({ animate: false }))
    resize.observe(container.current)

    map.current = instance
    return () => {
      resize.disconnect()
      instance.remove()
      map.current = null
    }
  }, [setReference])

  // Draw whatever is inside the viewport, re-clustered for the current zoom.
  useEffect(() => {
    const instance = map.current
    const layer = markerLayer.current
    const letters = letterLayer.current
    if (!instance || !layer || !letters || !data) return

    const render = () => {
      layer.clearLayers()
      letters.clearLayers()
      if (!index) return
      const bounds = instance.getBounds()
      const zoom = Math.round(instance.getZoom())
      const clusters = index.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        zoom,
      )

      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates
        const properties = feature.properties as PointProps &
          ClusterProps & {
            cluster?: boolean
            cluster_id?: number
            point_count?: number
          }

        if (properties.cluster) {
          const total = properties.point_count ?? 0
          const size = total > 1000 ? 52 : total > 200 ? 44 : total > 40 ? 38 : 32
          const marked = properties.marked ?? 0
          const label = total >= 1000 ? `${Math.round(total / 100) / 10}rb` : String(total)
          const badge =
            marked > 0
              ? `<span class="cluster-mark">${marked >= 1000 ? `${Math.round(marked / 100) / 10}rb` : marked}</span>`
              : ''

          // A grey bubble hides which division is under it. Fill the bubble
          // with the division that owns most of its points, and draw the rest
          // as a conic slice ring so a mixed area still looks mixed.
          const parts = properties.perDivision ?? []
          let dominant = 0
          for (let i = 1; i < parts.length; i += 1) if (parts[i] > parts[dominant]) dominant = i
          const base =
            mode === 'divisi'
              ? dominant >= DIVISIONS.length
                ? UNKNOWN_COLOR
                : DIVISION_COLORS[DIVISIONS[dominant]]
              : mode === 'status'
                ? marked > total / 2
                  ? STATUS_COLOURS.marked
                  : STATUS_COLOURS.covered
                : '#0284c7'
          let sweep = ''
          if (mode === 'divisi') {
            let at = 0
            const stops: string[] = []
            for (let i = 0; i < parts.length; i += 1) {
              if (!parts[i]) continue
              const share = (parts[i] / Math.max(total, 1)) * 360
              const colour = i >= DIVISIONS.length ? UNKNOWN_COLOR : DIVISION_COLORS[DIVISIONS[i]]
              stops.push(`${colour} ${at.toFixed(1)}deg ${(at + share).toFixed(1)}deg`)
              at += share
            }
            sweep = `<span class="cluster-ring" style="background:conic-gradient(${stops.join(',')})"></span>`
          }
          // The ring means "mostly gaps"; the badge counts them exactly.
          const icon = L.divIcon({
            html: `<div class="cluster-bubble" data-marked="${marked / Math.max(total, 1) >= 0.5 ? 1 : 0}" style="width:${size}px;height:${size}px;font-size:${size > 40 ? 13 : 12}px;--bubble:${base};color:${inkOn(base)}">${sweep}<span class="cluster-count">${label}</span>${badge}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
          L.marker([lat, lng], { icon, keyboard: false })
            .on('click', () => {
              const target = index.getClusterExpansionZoom(properties.cluster_id ?? 0)
              instance.setView([lat, lng], Math.min(target, 19))
            })
            .addTo(layer)
          continue
        }

        const row = properties.row
        const division = properties.division
        const colour = pinColour(mode, division, properties.marked, properties.omzet)
        const isSelected = selected === row
        const radius = zoom >= LETTER_ZOOM ? 11 : zoom >= 15 ? 8 : 6
        const marker = L.circleMarker([lat, lng], {
          renderer: canvas.current ?? undefined,
          radius: isSelected ? radius + 4 : radius,
          fillColor: colour,
          fillOpacity: 0.95,
          color: properties.marked ? '#f59e0b' : '#ffffff',
          weight: properties.marked ? 3 : isSelected ? 3 : 1.5,
        })
        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event)
          setSelected(row)
        })
        marker.addTo(layer)

        if (zoom >= LETTER_ZOOM && mode === 'divisi') {
          const letter = division === NO_DIVISION ? '?' : DIVISION_INITIALS[DIVISIONS[division]]
          L.marker([lat, lng], {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              html: `<div class="marker-letter" style="width:22px;height:22px;font-size:12px">${letter}</div>`,
              className: '',
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          }).addTo(letters)
        }
      }
    }

    render()
    instance.on('moveend zoomend', render)
    return () => {
      instance.off('moveend zoomend', render)
    }
  }, [data, index, selected, setSelected, mode])

  // Frame the data the first time it arrives, and again whenever the user asks.
  useEffect(() => {
    const instance = map.current
    if (!instance || !data) return
    // Refit only on a fresh dataset or a new request — never on every filter
    // change, which would yank the map around while the user is reading it.
    if (fitted.current && fitToken === lastFit.current) return
    if (result.count === 0) return
    const size = instance.getSize()
    if (size.x < 40 || size.y < 40) return
    // Fit to where the outlets actually are, not to the handful of strays: a
    // single mistyped coordinate would otherwise zoom the whole city out.
    const lats: number[] = []
    const lngs: number[] = []
    for (let i = 0; i < result.count; i += 1) {
      const row = result.rows[i]
      if (data.positionSource[row] === 0) continue
      lats.push(data.lat[row])
      lngs.push(data.lng[row])
    }
    if (lats.length === 0) return
    lats.sort((a, b) => a - b)
    lngs.sort((a, b) => a - b)
    const low = Math.floor(lats.length * 0.01)
    const high = Math.ceil(lats.length * 0.99) - 1
    const minLat = lats[low]
    const maxLat = lats[Math.max(low, high)]
    const minLng = lngs[low]
    const maxLng = lngs[Math.max(low, high)]
    if (minLat > maxLat) return
    instance.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [24, 24] },
    )
    fitted.current = true
    lastFit.current = fitToken
  }, [data, result, fitToken])

  // The reference point and the selected outlet.
  useEffect(() => {
    const instance = map.current
    const layer = referenceLayer.current
    if (!instance || !layer) return
    layer.clearLayers()
    if (!reference) return
    L.marker([reference.lat, reference.lng], {
      interactive: false,
      icon: L.divIcon({
        html: '<div class="pin-pulse" style="position:relative;width:16px;height:16px;border-radius:9999px;background:#0ea5e9;border:3px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,.4)"></div>',
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(layer)
  }, [reference])

  // Keep the selected outlet in view when it is chosen from a list.
  useEffect(() => {
    const instance = map.current
    if (!instance || !data || selected === null) return
    if (data.positionSource[selected] === 0) return
    const point = L.latLng(data.lat[selected], data.lng[selected])
    if (!instance.getBounds().pad(-0.15).contains(point)) {
      instance.setView(point, Math.max(instance.getZoom(), 16), { animate: true })
    }
  }, [selected, data])

  return <div ref={container} className="h-full w-full" />
}
