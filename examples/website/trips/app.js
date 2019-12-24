/* global window */
import React, { useEffect, useState, useRef } from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import {TripsLayer} from '@deck.gl/geo-layers';

// Set your mapbox token here
const MAPBOX_TOKEN = 'pk.eyJ1IjoicGllcnJpY2tibCIsImEiOiJjazRhMjBkcXQwMmhsM2VwMXkyM3JyZW54In0.qv1Lq36PUGxriIIbLUtovw'; // eslint-disable-line

// Source data CSV
const DATA_URL = {
  TRIPS:
    'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/trips-v7.json' // eslint-disable-line
};

const EVENT_URI = 'http://localhost:5000/Event';

const DEFAULT_THEME = {
  buildingColor: [74, 80, 87],
  trailColor0: [253, 128, 93],
  trailColor1: [23, 184, 190],
};

let currentViewState = {
  longitude: 0, //-4.880748,
  latitude: 0, //48.349953,
  zoom: 2,
  pitch: 0,
  bearing: 0
};

const useAnimationFrame = callback => {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = time => {
    if(previousTimeRef.current != undefined) // Check if le previousTimeRef is defined
    {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    animate();
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
  }, []);
};

const Map = (props) => {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useAnimationFrame((deltaTime) => {
      setTime((time) => { 
        if(isPlaying) { 
            return (time + deltaTime * 60) % props.setup.loopLength;
        }
        else {
          return 0;
        }
      });
  });

  const renderLayers = () => {
    return [
      new TripsLayer({
        id: 'trips',
        data: props.setup.trips,
        getPath: d => d.path,
        getTimestamps: d => d.timestamps,
        getColor: d => (d.vendor === 0 ? props.setup.theme.trailColor0 : props.setup.theme.trailColor1),
        opacity: 0.3,
        widthMinPixels: 2,
        rounded: true,
        trailLength: props.setup.trailLength,
        currentTime: time,
        shadowEnabled: false
      })
    ];
  }

  return (
      <DeckGL
        layers={renderLayers()}
        effects={props.setup.theme.effects}
        initialViewState={currentViewState}
        viewState={currentViewState}
        onViewStateChange={({viewState}) => {
          currentViewState = viewState;
        }}
        controller={true}
      >
        <StaticMap
          reuseMaps
          mapStyle={props.setup.mapStyle}
          preventStyleDiffing={true}
          mapboxApiAccessToken={props.setup.mapToken}
        />
      </DeckGL>
  );
}

const App = () => {
  const [tracks, setTracks] = useState([]);

  const setupMap = {
    trips : tracks,
    trailLength : 1000000,
    theme : DEFAULT_THEME,
    loopLength : 5000000, // unit corresponds to the timestamp in source data
    animationSpeed : 60, // unit time per second
    viewState : currentViewState,
    mapToken : MAPBOX_TOKEN,
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
  };

  async function fetchTracks(eventId) {
    const eventDetailsResult = await fetch(`${EVENT_URI}/${eventId}`);
    eventDetailsResult.json()
      .then(eventDetails => eventDetails.eventBoats.forEach(eventBoat => fetchTrack(eventDetails, eventBoat.id)));
  }

  async function fetchTrack({id: eventId, startDate: eventStartDate }, boatParticipantId) {
    const tracksResult = await fetch(`${EVENT_URI}/${eventId}/boat/${boatParticipantId}/trace-hd?api-version=2.0`);
    tracksResult.json()
      .then(trackJson => { 
          const firstTimestampOfTrack = new Date(eventStartDate).getTime() / 1000;
          setTracks(tracks => [ ...tracks, 
            {
              vendor: 1,
              path: trackJson.tracks.geometry.coordinates[0],
              timestamps: trackJson.telemetry[0].map(telemetry => {
                return (new Date(telemetry.timestamp).getTime() / 1000) - firstTimestampOfTrack;
              })
            }]
          ); 
        }
      );
  }

  useEffect(() => {
    fetchTracks(19);
  }, []);

  return (
    <Map setup={setupMap} />
  )
}

export default App;

export function renderToDOM(container) {
  render(<App />, container);
}
