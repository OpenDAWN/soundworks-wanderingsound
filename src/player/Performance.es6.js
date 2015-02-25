'use strict';

var clientSide = require('soundworks/client');
var client = clientSide.client;
var input = clientSide.input;
var audioContext = require('audio-context');
var SimpleSynth = require('./SimpleSynth');

function beep() {
  var time = audioContext.currentTime;
  var duration = 0.2;
  var attack = 0.001;

  var g = audioContext.createGain();
  g.connect(audioContext.destination);
  g.gain.value = 0;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.5, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0000001, time + duration);
  g.gain.setValueAtTime(0, time);

  var o = audioContext.createOscillator();
  o.connect(g);
  o.frequency.value = 600;
  o.start(time);
  o.stop(time + duration);
}

class Performance extends clientSide.Module {
  constructor(seatmap, checkin, params = {}) {
    super(params);

    this.seatmap = seatmap;
    this.checkin = checkin;
    this.synths = [new SimpleSynth(false), new SimpleSynth(true)];

    // place info display
    var infoDiv = document.createElement('div');
    infoDiv.setAttribute('id', 'info');
    infoDiv.classList.add('centered-content');
    infoDiv.classList.add('info');

    this.infoDiv = infoDiv;
    this.displayDiv.appendChild(this.infoDiv);

    // seatmap display
    var seatmapDiv = document.createElement('div');
    seatmapDiv.setAttribute('id', 'seatmap');

    this.seatmapDiv = seatmapDiv;
    this.displayDiv.appendChild(this.seatmapDiv);

    // setup liteners
    this.__inputListener();
    this.__performanceControlListener();

    var socket = client.socket;

    socket.on('players_init', (playerList) => {
      this.__initPlayers(playerList);
    });

    socket.on('player_add', (player) => {
      this.__addPlayer(player);
    });

    socket.on('player_remove', (player) => {
      this.__removePlayer(player);
    });

    socket.on('soloists_init', (soloistList) => {
      this.__initSoloists(soloistList);
    });

    socket.on('soloist_add', (soloist) => {
      this.__addSoloist(soloist);
    });

    socket.on('soloist_remove', (soloist) => {
      this.__removeSoloist(soloist);
    });
  }

  __initPlayers(playerList) {
    for (let i = 0; i < playerList.length; i++)
      this.seatmap.addClassToTile(this.seatmapDiv, playerList[i].index, 'player');
  }

  __addPlayer(player) {
    this.seatmap.addClassToTile(this.seatmapDiv, player.index, 'player');
  }

  __removePlayer(player) {
    this.seatmap.removeClassFromTile(this.seatmapDiv, player.index, 'player');

    var soloistId = player.soloistId;

    if (soloistId) {
      this.synths[soloistId].update(1, 0);
      this.__changeBackgroundColor(1);
    }
  }

  __initSoloists(soloistList) {
    // for (let i = 0; i < soloistList.length; i++)
    //   this.seatmap.addClassToTile(this.seatmapDiv, soloistList[i].index, 'soloist');
  }

  __addSoloist(soloist) {
    // this.seatmap.addClassToTile(this.seatmapDiv, soloist.index, 'soloist');

    var socket = client.socket;

    if (soloist.socketId === socket.io.engine.id) {
      input.enableTouch(this.seatmapDiv);

      this.infoDiv.classList.add('hidden');
      this.seatmapDiv.classList.remove('hidden');

      beep();
    }
  }

  __removeSoloist(soloist) {
    var soloistId = soloist.soloistId;

    // this.seatmap.removeClassFromTile(this.seatmapDiv, soloist.index, 'soloist');

    this.synths[soloistId].update(1, 0);
    this.__changeBackgroundColor(1); // TODO: incorrect

    var socket = client.socket;

    if (soloist.socketId === socket.io.engine.id) {
      input.disableTouch(this.seatmapDiv);

      this.seatmapDiv.classList.add('hidden');
      this.infoDiv.classList.remove('hidden');
    }
  }

  __changeBackgroundColor(d) {
    var value = Math.floor(Math.max(1 - d, 0) * 255);
    this.displayDiv.style.backgroundColor = 'rgb(' + value + ', ' + value + ', ' + value + ')';
  }

  __inputListener() {
    input.on('touchstart', this.__touchHandler.bind(this));
    input.on('touchmove', this.__touchHandler.bind(this));
    input.on('touchend', this.__touchHandler.bind(this));
  }

  __performanceControlListener() {
    var socket = client.socket;

    socket.on('perf_control', (soloistId, d, s) => {
      this.synths[soloistId].update(d, s);
      this.__changeBackgroundColor(d);
    });
  }

  __touchHandler(touchData) {
    var socket = client.socket;
    var x = (touchData.coordinates[0] - this.seatmapDiv.offsetLeft + window.scrollX) / this.seatmapDiv.offsetWidth;
    var y = (touchData.coordinates[1] - this.seatmapDiv.offsetTop + window.scrollY) / this.seatmapDiv.offsetHeight;

    socket.emit(touchData.event, [x, y], touchData.timestamp); // TODO: might be a good idea to send the time in sever clock. (Requires sync module.)
  }

  start() {
    super.start();

    client.socket.emit('perf_start');

    if (this.displayDiv) {
      this.infoDiv.innerHTML = "<p class='small'>You are at position</p>" + "<div class='checkin-label'><span>" + this.checkin.label + "</span></div>";
      this.infoDiv.classList.remove('hidden');
    }

    this.seatmap.display(this.seatmapDiv);
    this.seatmap.addClassToTile(this.seatmapDiv, this.checkin.index, 'me');
    super.start();
  }
}

module.exports = Performance;