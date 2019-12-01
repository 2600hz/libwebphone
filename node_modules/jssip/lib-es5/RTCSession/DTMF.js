"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var EventEmitter = require('events').EventEmitter;

var JsSIP_C = require('../Constants');

var Exceptions = require('../Exceptions');

var Utils = require('../Utils');

var debug = require('debug')('JsSIP:RTCSession:DTMF');

var debugerror = require('debug')('JsSIP:ERROR:RTCSession:DTMF');

debugerror.log = console.warn.bind(console);
var C = {
  MIN_DURATION: 70,
  MAX_DURATION: 6000,
  DEFAULT_DURATION: 100,
  MIN_INTER_TONE_GAP: 50,
  DEFAULT_INTER_TONE_GAP: 500
};

module.exports =
/*#__PURE__*/
function (_EventEmitter) {
  _inherits(DTMF, _EventEmitter);

  function DTMF(session) {
    var _this;

    _classCallCheck(this, DTMF);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(DTMF).call(this));
    _this._session = session;
    _this._direction = null;
    _this._tone = null;
    _this._duration = null;
    _this._request = null;
    return _this;
  }

  _createClass(DTMF, [{
    key: "send",
    value: function send(tone) {
      var _this2 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (tone === undefined) {
        throw new TypeError('Not enough arguments');
      }

      this._direction = 'outgoing'; // Check RTCSession Status.

      if (this._session.status !== this._session.C.STATUS_CONFIRMED && this._session.status !== this._session.C.STATUS_WAITING_FOR_ACK) {
        throw new Exceptions.InvalidStateError(this._session.status);
      }

      var extraHeaders = Utils.cloneArray(options.extraHeaders);
      this.eventHandlers = options.eventHandlers || {}; // Check tone type.

      if (typeof tone === 'string') {
        tone = tone.toUpperCase();
      } else if (typeof tone === 'number') {
        tone = tone.toString();
      } else {
        throw new TypeError("Invalid tone: ".concat(tone));
      } // Check tone value.


      if (!tone.match(/^[0-9A-DR#*]$/)) {
        throw new TypeError("Invalid tone: ".concat(tone));
      } else {
        this._tone = tone;
      } // Duration is checked/corrected in RTCSession.


      this._duration = options.duration;
      extraHeaders.push('Content-Type: application/dtmf-relay');
      var body = "Signal=".concat(this._tone, "\r\n");
      body += "Duration=".concat(this._duration);

      this._session.newDTMF({
        originator: 'local',
        dtmf: this,
        request: this._request
      });

      this._session.sendRequest(JsSIP_C.INFO, {
        extraHeaders: extraHeaders,
        eventHandlers: {
          onSuccessResponse: function onSuccessResponse(response) {
            _this2.emit('succeeded', {
              originator: 'remote',
              response: response
            });
          },
          onErrorResponse: function onErrorResponse(response) {
            if (_this2.eventHandlers.onFailed) {
              _this2.eventHandlers.onFailed();
            }

            _this2.emit('failed', {
              originator: 'remote',
              response: response
            });
          },
          onRequestTimeout: function onRequestTimeout() {
            _this2._session.onRequestTimeout();
          },
          onTransportError: function onTransportError() {
            _this2._session.onTransportError();
          },
          onDialogError: function onDialogError() {
            _this2._session.onDialogError();
          }
        },
        body: body
      });
    }
  }, {
    key: "init_incoming",
    value: function init_incoming(request) {
      var reg_tone = /^(Signal\s*?=\s*?)([0-9A-D#*]{1})(\s)?.*/;
      var reg_duration = /^(Duration\s?=\s?)([0-9]{1,4})(\s)?.*/;
      this._direction = 'incoming';
      this._request = request;
      request.reply(200);

      if (request.body) {
        var body = request.body.split('\n');

        if (body.length >= 1) {
          if (reg_tone.test(body[0])) {
            this._tone = body[0].replace(reg_tone, '$2');
          }
        }

        if (body.length >= 2) {
          if (reg_duration.test(body[1])) {
            this._duration = parseInt(body[1].replace(reg_duration, '$2'), 10);
          }
        }
      }

      if (!this._duration) {
        this._duration = C.DEFAULT_DURATION;
      }

      if (!this._tone) {
        debug('invalid INFO DTMF received, discarded');
      } else {
        this._session.newDTMF({
          originator: 'remote',
          dtmf: this,
          request: request
        });
      }
    }
  }, {
    key: "tone",
    get: function get() {
      return this._tone;
    }
  }, {
    key: "duration",
    get: function get() {
      return this._duration;
    }
  }]);

  return DTMF;
}(EventEmitter);
/**
 * Expose C object.
 */


module.exports.C = C;