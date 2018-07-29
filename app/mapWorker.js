const {uniqBy, uniq, assignIn, orderBy} = require('lodash');
const {each, findIndex, filter} = require('./lang');

const buildGalaxyOptions = function(state) {
  let options = [];
  let ids = [];
  let selectedGalaxy = state.selectedGalaxy;
  if (state.remoteLocations) {
    each(state.remoteLocations, (location) => {
      if (location.data.galaxy == null || location.data.galaxy < 0) {
        location.data.galaxy = 0;
      }
      ids.push(location.data.galaxy);
    });
  }
  if (state.selectedLocation && state.selectedLocation.galaxy) {
    ids.push(state.selectedLocation.galaxy);
  }
  each(uniq(ids), (id) => {
    options.push({
      id,
      label: state.galaxies[id]
    });
  });
  const stateUpdate = {
    galaxyOptions: orderBy(options, 'id', 'asc')
  };

  if (state.init) {
    stateUpdate.selectedGalaxy = state.ps4User ? 0 : selectedGalaxy;
  }
  postMessage({buildGalaxyOptions: stateUpdate, init: state.init});
};

const getLocationsByTranslatedId = function(locations) {
  if (!locations) {
    return null;
  }
  let systems = uniqBy(locations, (location) => {
    location = location.data ? location : {data: location};
    return location.data.translatedX && location.data.translatedY && location.data.translatedZ;
  });
  each(systems, (location, i) => {
    systems[i] = location.data ? location : {data: location};
    location = systems[i];
    let planets = filter(locations, (planet) => {
      planet = planet.data ? planet : {data: planet};
      return (location.data.translatedX === planet.data.translatedX
        && location.data.translatedY === planet.data.translatedY
        && location.data.translatedZ === planet.data.translatedZ);
    });
    let planetData = [];
    each(planets, (planet) => {
      planet = planet.data ? planet : {data: planet};
      if (!planetData[planet.data.username]) {
        planetData[planet.data.username] = [];
      }
      let label = planet.data.name ? planet.data.name : planet.data.id;
      let refPlanetData = findIndex(planetData, item => item && item.username === planet.data.username);
      if (refPlanetData > -1) {
        let refEntry = planetData[refPlanetData].entries.indexOf(label);
        if (refEntry === -1) {
          planetData[refPlanetData].entries.push(label);
        }
      } else {
        planetData.push({
          username: planet.data.username,
          entries: [label]
        });
      }
    });
    location.data.planetData = planetData;
  });
  return systems
}

onmessage = function(e) {
  if (e.data.buildGalaxyOptions) {
    buildGalaxyOptions(e.data.buildGalaxyOptions);
    return;
  }
  let stateUpdate = {};
  let center = e.data.p.show.Center.value ? [{
    x: 2047,
    y: 2047,
    z: 127
  }] : [];

  e.data.p.remoteLocations = getLocationsByTranslatedId(e.data.p.remoteLocations);

  if (e.data.opts.selectedLocation) {
    let selectedLocation = [];
    if (e.data.p.remoteLocations && e.data.p.remoteLocations) {
      each(e.data.p.remoteLocations, (location) => {
        if (location.data.galaxy !== e.data.p.selectedGalaxy) {
          return;
        }
        if (e.data.p.selectedLocation && e.data.p.show.Selected.value
          && location.data.translatedX === e.data.p.selectedLocation.translatedX
          && location.data.translatedY === e.data.p.selectedLocation.translatedY
          && location.data.translatedZ === e.data.p.selectedLocation.translatedZ) {
          selectedLocation[0] = {
            x: location.data.translatedX,
            y: (0, 4096) - location.data.translatedZ,
            z: location.data.translatedY,
            selected: true,
            id: `${location.data.translatedX}:${location.data.translatedY}:${location.data.translatedZ}`,
            planetData: location.data.planetData
          };
        }
      });
    }
    assignIn(stateUpdate, {
      selectedLocation: selectedLocation
    });
  }

  if (e.data.opts.locations) {
    Object.assign(stateUpdate, {
      currentLocation: [],
      locations: [],
      remoteLocations: [],
      favLocations: [],
      baseLocations: [],
      ps4Locations: []
    })

    let friendKeys = [];
    each(e.data.p.show, (legendItem, key) => {
      if (e.data.p.defaultLegendKeys.indexOf(key) === -1) {
        friendKeys.push(key);
      }
    });

    if (e.data.p.remoteLocations && e.data.p.remoteLocations) {
      each(e.data.p.remoteLocations, (location) => {
        if (location.data.galaxy !== e.data.p.selectedGalaxy) {
          return;
        }
        let obj = {
          x: location.data.translatedX,
          y: (0, 4096) - location.data.translatedZ,
          z: location.data.translatedY,
          id: `${location.data.translatedZ}:${location.data.translatedY}:${location.data.translatedX}`,
          planetData: location.data.planetData
        };
        let matchedFriendKey = false;
        each(friendKeys, (key) => {
          if (location.username === key) {
            let listKey = `${key}Locations`;
            matchedFriendKey = true;
            if (!stateUpdate[listKey]) {
              stateUpdate[listKey] = [];
            }
            if (e.data.p.show[key].value) {
              stateUpdate[listKey].push(obj);
            }
          }
        });
        if (matchedFriendKey) {
          return;
        }
        if (location.data.upvote && e.data.p.show.Favorite.value) {
          stateUpdate.favLocations.push(obj);
        } else if (location.data.id === e.data.p.currentLocation) {
          if (e.data.p.show.Current.value) {
            stateUpdate.currentLocation.push(obj);
          }
        } else if (location.data.base) {
          if (e.data.p.show.Base.value) {
            stateUpdate.baseLocations.push(obj);
          }
        } else if (location.data.username === e.data.p.username) {
          if (e.data.p.show.Explored.value) {
            stateUpdate.locations.push(obj);
          }
        } else if (location.username !== e.data.p.username && (!location.data.playerPosition || location.data.manuallyEntered)) {
          if (e.data.p.show.PS4.value) {
            stateUpdate.ps4Locations.push(obj);
          }
        } else if (location.username !== e.data.p.username) {
          if (e.data.p.show.Shared.value) {
            stateUpdate.remoteLocations.push(obj);
          }
        }
      });
    }
  }

  if (e.data.opts.size) {
    let zRange = [14, 32];
    let ticks = [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304, 2560, 2816, 3072, 3328, 3584, 3840, 4096];

    let remoteLocationsWidth;
    if (e.data.p.remoteLocationsColumns === 1) {
      remoteLocationsWidth = 441;
    } else if (e.data.p.remoteLocationsColumns === 2) {
      remoteLocationsWidth = 902;
    } else {
      remoteLocationsWidth = 1300;
    }

    let size = e.data.p.width - (remoteLocationsWidth + 438);
    let maxSize = e.data.p.height - 105;
    size = size > maxSize ? maxSize : size < 260 ? 260 : size;

    assignIn(stateUpdate, {
      size: size,
      center: center,
      zRange: zRange,
      ticks: ticks
    });
  }

  postMessage(stateUpdate);
}