/*
	Kazoo WebRTC/RTMP Library v0.1
	Created by Jean-Roch Maitre for 2600hz (jr@2600hz.com).
*/

(function () {
	var kazoo = {
		config: {
			paths: {
				AC_OETags: 'lib/dependencies/AC_OETags.js',
				// SIPml5: 'lib/dependencies/SIPml-api-1.2.185.js',
				SIPml5: 'lib/dependencies/SIPml-api.js',
				VideoIO: 'lib/dependencies/VideoIO'
			},
		},
		rtmp: {},
		webrtc: {}
	},
	errors = {
		serverNotReachable: {
			key: "server_not_reachable",
			message: "Could not reach the server."
		},
		unauthorized: {
			key: "unauthorized",
			message: "Invalid credentials."
		},
		forbidden: {
			key: "forbidden",
			message: "Forbidden."
		},
		disconnected: {
			key: "disconnected",
			message: "You have been disconnected."
		}
	},
	notifications = {
		"overriding": {
			key: "overriding_registration",
			message: "You have overridden an existing registration for this device."
		},
		"replaced": {
			key: "replaced_registration",
			message: "You have been disconnected: someone else has registered this device."
		},
		"voicemail": {
			key: "voicemail_notification",
			message: "You have one or more voicemail message(s)."
		},
		"default": {
			key: "unknown_notification",
			message: "You have received a SIP notification."
		}
	};

	function kazooLoadScript(scriptSrc, callback) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = scriptSrc;
		script.async = true;

		script.onreadystatechange = script.onload = function() {
			var state = script.readyState;
			if (!callback.done && (!state || /loaded|complete/.test(state))) {
				callback.done = true;
				callback();
			}
		};

		document.getElementsByTagName('head')[0].appendChild(script);
	};

	function getFlashMovie(movieName) {
		var isIE = navigator.appName.indexOf("Microsoft") != -1;
		return (isIE) ? window[movieName] : document[movieName];
	};

	kazoo.init = function(params) {
		if(params.forceRTMP) {
			loadRTMP();
		}
		else {
			getSupportedVersion();
		}

		function getSupportedVersion() {
			if(!window.mozRTCPeerConnection && !navigator.webkitGetUserMedia){
				loadRTMP();
			}
			else {
				loadSIPml5();
			}
		};

		function loadRTMP() {
			if(getFlashMovie('kazooRTMP') === undefined) {
				kazooLoadScript(kazoo.config.paths.AC_OETags, function() {
					var hasProductInstall = DetectFlashVer(6, 0, 65),
						hasVersion10 = DetectFlashVer(10, 0, 0),
						hasVersion10_3 = DetectFlashVer(10, 3, 0),
						hasVersion11 = DetectFlashVer(11, 0, 0);

					var flashHTML = '';

					if (hasProductInstall && !hasVersion10) {
						var MMPlayerType = (isIE == true) ? "ActiveX" : "PlugIn";
						var MMredirectURL = window.location;
						document.title = document.title.slice(0, 47) + " - Flash Player Installation";
						var MMdoctitle = document.title;

						flashHTML = AC_FL_RunContent(
							"src", "playerProductInstall",
							"FlashVars", "MMredirectURL="+MMredirectURL+'&MMplayerType='+MMPlayerType+'&MMdoctitle='+MMdoctitle+"",
							"width", "0",
							"height", "0",
							"align", "middle",
							"wmode", "transparent",
							"id", "kazooRTMP",
							"quality", "high",
							"bgcolor", "#000000",
							"name", "kazooRTMP",
                                                        "camera", "false",
                                                        "play", "true",
                                                        "loop", "false",
							"allowScriptAccess","always",
							"type", "application/x-shockwave-flash",
							"pluginspage", "http://www.adobe.com/go/getflashplayer"
						);
					}
					else if (hasVersion10) {
						 flashHTML = AC_FL_RunContent(
								"src", kazoo.config.paths.VideoIO,
								"width", "0",
								"height", "0",
								"wmode", "transparent",
								"align", "middle",
								"id", "kazooRTMP",
								"quality", "high",
                                                                "camera", "false",
                                                                "play", "true",
                                                                "loop", "false",
								"bgcolor", "#000000",
								"name", "kazooRTMP",
								"allowScriptAccess","always",
								"allowFullScreen","true",
								"type", "application/x-shockwave-flash",
								"pluginspage", "http://www.adobe.com/go/getflashplayer"
						);
					}

					kazoo.version = 'rtmp';

					var container = document.createElement('div');
					container.id = 'kazooVideoPlayer';
					container.innerHTML = flashHTML;

					document.getElementsByTagName('body')[0].appendChild(container);

					kazoo.rtmp.container = container;

					if(hasProductInstall) {
						var testTimer = setInterval(function () {
							if (typeof getFlashMovie('kazooRTMP').setProperty === 'function') {
								clearInterval(testTimer);

								params.onLoaded && params.onLoaded();
							}
						},
						500);
					} else {
						if(typeof params.onFlashMissing === 'function') {
							params.onFlashMissing(container);
						} else {
							container.innerHTML = 'This content requires the Adobe Flash Player. <a href=http://www.adobe.com/go/getflash/>Get Flash</a>';
						}
					}
				});
			}
		};

		function loadSIPml5() {
			kazooLoadScript(kazoo.config.paths.SIPml5, function() {
				var oReadyStateTimer = setInterval(function () {
					if (document.readyState === 'complete') {
						clearInterval(oReadyStateTimer);

						SIPml.init(postInit);
					}
				}, 500);

				var postInit = function() {
					if (SIPml.isWebRtcSupported()) {
						kazoo.version = 'webrtc';

						kazoo.audioRemote = document.createElement('audio');
						kazoo.audioRemote.id = 'kazooAudioRemote';
						kazoo.audioRemote.autoplay = "autoplay";
						document.getElementsByTagName('body')[0].appendChild(kazoo.audioRemote);

						params.onLoaded && params.onLoaded();
					}
					else {
						console.log('browser not supported');
					}
				}
			});
		};
	};

	kazoo.register = function(params) {
		kazoo.params = params;

		if(kazoo.version === 'webrtc') {
			var eventsListener = function(e) {
				console.log(e)
				switch(e.type) {
					case 'started': {
						login();

						params.started && params.started();

						break;
					}
					case 'i_new_message': {
						acceptMessage(e);

						params.newMessage && params.newMessage();

						break;
					}
					case 'i_new_call': {
						var call = {
								accept: function() {
									acceptCall(e);
									
									params.onAccepted && params.onAccepted();
								},
								reject: function() {
									rejectCall(e);
								},
								callerName: e.o_event.o_message.o_hdr_From.s_display_name
							};

						e.newSession.addEventListener('*', kazoo.webrtc.eventsListener);
						e.newSession.audio_remote = document.getElementById('audio_remot');

						params.onIncoming && params.onIncoming(call);

						break;
					}
					case 'connected': {
						if(e.description === 'Connected') {
							var response = {
								status: kazoo.webrtc.registerSession
							};

							params.onConnected && params.onConnected(response);
						}
						else if(e.description === 'In Call') {
							params.onAccepted && params.onAccepted();
						}

						break;
					}
					case 'm_early_media': {
						if(e.description === 'Session Progress') {
							kazoo.webrtc.isRinging = true;

							params.onRinging && params.onRinging();
						}
						else if(e.description === 'OK') {
							kazoo.webrtc.isRinging = false;
						}

						break;
					}
					case 'failed_to_start': {
						params.onError && params.onError({
							key: 'error',
							message: e.description || 'Error',
							source: e
						});
						break;
					}
					case 'terminated': {
						var errCode = e.o_event && e.o_event.get_message() && e.o_event.get_message().is_response() ? e.o_event.get_message().get_response_code() : -1;
						
						switch(errCode) {
							case 603: //Decline
							case 486: //Busy Here
							case 480: //Temporarily Unavailable
							case 481: //Call/Transaction Does Not Exist
								kazoo.webrtc.currentCall = null;
								kazoo.webrtc.isRinging = false;
								params.onCancel && params.onCancel({
									code: errCode,
									message: e.description,
									source: e
								});
								break;
							case 403: //Forbidden
								params.onError && params.onError({
									key: errors.forbidden.key,
									message: errors.forbidden.message,
									code: errCode,
									source: e
								});
								break;
							case 401: //Unauthorized
							case 407: //Proxy Authentication Required
								params.onError && params.onError({
									key: errors.unauthorized.key,
									message: errors.unauthorized.message,
									code: errCode,
									source: e
								});
								break;
							default:
								if('currentCall' in kazoo.webrtc) {
									kazoo.webrtc.currentCall = null;
									params.onHangup && params.onHangup(response);
								}
								break;
						}
						break;
					}
					case 'stopped': {
						kazoo.webrtc.sipStack = null;
						kazoo.webrtc.registerSession = null;
						kazoo.webrtc.currentCall = null;

						break;
					}
					case 'custom_message': {
						if('data' in e.source && e.source.data.indexOf('NOTIFY') === 0) {
							if(e.source.data.match(/Overwrote:".+"/)) {
								params.onNotified && params.onNotified({
									key: notifications.overriding.key,
									message: notifications.overriding.message,
									source: e
								});
							} else if(e.source.data.match(/Replaced\-By:".+"/)) {
								params.onNotified && params.onNotified({
									key: notifications.replaced.key,
									message: notifications.replaced.message,
									source: e
								});
							} else if(e.source.data.match(/Message\-Account:".+"/)) {
								params.onNotified && params.onNotified({
									key: notifications.voicemail.key,
									message: notifications.voicemail.message,
									source: e
								});
							} else {
								params.onNotified && params.onNotified({
									key: notifications['default'].key,
									message: notifications['default'].message,
									source: e
								});
							}
						} else if('data' in e.source && e.source.data.indexOf('CANCEL') === 0) {
							kazoo.webrtc.currentCall = null;
							kazoo.webrtc.isRinging = false;
							params.onCancel && params.onCancel({
								message: "Originator Cancel",
								source: e
							});
						}
						break;
					}
					default: {
						break;
					}
				}
			};

			kazoo.webrtc.eventsListener = eventsListener;

			function createSipStack() {
				kazoo.webrtc.sipStack = new SIPml.Stack({
					realm: params.realm,
					impi: params.privateIdentity,
					impu: params.publicIdentity,
					password: params.password,
					websocket_proxy_url: params.wsUrl,
					outbound_proxy_url: null,
					ice_servers: [],
					enable_rtcweb_breaker: false,
					enable_early_ims: true, // Must be true unless you're using a real IMS network
					enable_media_stream_cache: false,
					bandwidth: null, // could be redefined a session-level
					video_size:null, // could be redefined a session-level
					events_listener: { events: '*', listener: eventsListener }
				});

				kazoo.webrtc.sipStack.o_stack.network.ao_ice_servers = [];
			};

			function acceptCall(e) {
				kazoo.webrtc.currentCall = e.newSession;

				e.newSession.accept({
					events_listener: { events: '*', listener: kazoo.webrtc.eventsListener },
					audio_remote: kazoo.audioRemote
				});
			};

			function rejectCall(e) {
				e.newSession.reject();
			};

			function login() {
				kazoo.webrtc.registerSession = kazoo.webrtc.sipStack.newSession('register', {
					events_listener: { events: '*', listener: eventsListener }
				});

				kazoo.webrtc.registerSession.register();
			};

			createSipStack();

			kazoo.webrtc.sipStack.start();
		}
		else if(kazoo.version === 'rtmp') {
			var server = params.rtmpUrl,
				user = params.privateIdentity + '@' + params.realm,
				authname = params.privateIdentity,
				authpass = params.password,
				displayname = params.publicIdentity,
				rate = 8,
				rateName = 'narrowband';

			var phone = getFlashMovie('kazooRTMP'),
				srcValue = server + '/' +user+ '?rate=' +rate+ '&bidirection=true' + '&arg=' +authname+ '&arg=' +authpass+ '&arg=' +displayname+ '&arg=' +rateName;

			phone.setProperty('src', srcValue);
			kazoo.rtmp.phone = phone;

			onPropertyChange = function(event) {
				console.log('onPropertyChange', event);
				switch(event.property) {
					case 'src': {
						if(event.newValue !== null) { // If src newValue has been set
							kazoo.rtmp.isConnecting = true;
						} else { // If src newValue is null
							if(kazoo.rtmp.isConnecting) {
								params.onError && params.onError({
									key: errors.serverNotReachable.key,
									message: errors.serverNotReachable.message,
									source: event
								});
							} else if(kazoo.rtmp.isConnected) {
								params.onError && params.onError({
									key: errors.disconnected.key,
									message: errors.disconnected.message,
									source: event
								});
							}
							kazoo.rtmp.isConnected = false;
							kazoo.rtmp.isConnecting = false;
						}
						break;
					}
					case 'nearID': {
						if(event.newValue !== null) {
							kazoo.rtmp.isConnecting = false;
							kazoo.rtmp.isConnected = true;
							params.onConnected && params.onConnected();
						}
						break;
					}
					default: {
						break;
					}
				}
			};

			onCallback = function(event) {
				console.log('onCallback', event);
				switch(event.method) {
					case 'ringing': {
						params.onRinging && params.onRinging();

						break;
					}
					case 'rejected': {
						var matchResult = event.args.length ? event.args[0].match(/^(\d{3}) ?(.*)$/) : null,
							cancelStatus = {
								source: event
							};

						if(matchResult) {
							cancelStatus.code = parseInt(matchResult[1], 10);
							cancelStatus.message = matchResult[2];
						} else if(event.args.length) {
							cancelStatus.message = event.args[0];
						}

						params.onCancel && params.onCancel(cancelStatus);

						break;
					}
					case 'cancelled': {
						params.onCancel && params.onCancel({
							message: "Originator Cancel",
							source: event
						});
						break;
					}
					case 'invited': {
						var call = {
							accept: function() {
								phone.callProperty('call', 'accept');

								kazoo.rtmp.isCalling = true;
							},
							reject: function() {
								phone.callProperty('call', 'reject', '486 Busy Here');
							},
							callerName: event.args[0]
						};

						params.onIncoming && params.onIncoming(call);

						break;
					}
					case 'accepted': {
						phone.setProperty('publish', 'local');
						phone.setProperty('play', 'remote');
						kazoo.rtmp.isCalling = true;

						params.onAccepted && params.onAccepted();

						break;
					}
					case 'byed': {
						phone.setProperty('publish', null);
						phone.setProperty('play', null);
						kazoo.rtmp.isCalling = false;

						params.onHangup && params.onHangup();

						break;
					}
					case 'notified': {
						var notificationType = event.args[1].substring(0, event.args[1].indexOf(':')),
							notification = {};

						switch(notificationType) {
							case 'Overwrote': {
								notification = {
									key: notifications.overriding.key,
									message: notifications.overriding.message
								}
								break;
							}
							case 'Replaced-By': {
								notification = {
									key: notifications.replaced.key,
									message: notifications.replaced.message
								}
								break;
							}
							case 'Message-Account': {
								notification = {
									key: notifications.voicemail.key,
									message: notifications.voicemail.message
								}
								break;
							}
							default: {
								notification = {
									key: notifications['default'].key,
									message: notifications['default'].message
								}
							}
						}
						notification.source = event;
						params.onNotified && params.onNotified(notification);
						break;
					}
					case 'unauthorized': {
						var matchResult = event.args.length ? event.args[0].match(/^(\d{3}) ?(.*)$/) : null,
							errCode = matchResult && matchResult[1] ? parseInt(matchResult[1], 10) : 0;

						kazoo.rtmp.isConnecting = false;
						switch(errCode) {
							case 403: //Forbidden
								params.onError && params.onError({
									key: errors.forbidden.key,
									message: errors.forbidden.message,
									code: errCode,
									source: event
								});
								break;
							case 401: //Unauthorized
							case 407: //Proxy Authentication Required
							default:
								params.onError && params.onError({
									key: errors.unauthorized.key,
									message: errors.unauthorized.message,
									code: errCode,
									source: event
								});
								break;
						}
						break;
					}
					default: {
						console.log(event);
						break;
					}
				}
			}
		}
	};

	kazoo.hangup = function() {
		if(kazoo.version === 'webrtc') {
			kazoo.webrtc.currentCall.hangup();
		}
		else if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'bye');
			kazoo.rtmp.phone.setProperty('publish', null);
			kazoo.rtmp.phone.setProperty('play', null);

			kazoo.rtmp.isCalling = false;

			kazoo.params.onHangup && kazoo.params.onHangup();
		}
	};

	kazoo.logout = function() {
		if(kazoo.version === 'webrtc') {
			kazoo.webrtc.sipStack.stop();
		}
		else if(kazoo.version === 'rtmp') {
			if(kazoo.rtmp.isCalling === true) {
				kazoo.hangup();
			}

			kazoo.rtmp.phone.setProperty('src', '');
			kazoo.rtmp.isConnected = false;
		}
	};

	kazoo.transfer = function(destination) {
		if(kazoo.version === 'webrtc') {
			if(kazoo.webrtc.currentCall) {
				kazoo.webrtc.currentCall.transfer(destination);
			}
		}
		else if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'transfer', destination);
		}

		kazoo.params.onTransfer && kazoo.params.onTransfer();
	};

	//Destination should be a sip address like: sip:1234@realm.com
	kazoo.connect = function(destination) {
		if(destination) {
			if(kazoo.version === 'webrtc') {
				if(!kazoo.webrtc.currentCall) {
					kazoo.webrtc.currentCall = kazoo.webrtc.sipStack.newSession('call-audio', {
						events_listener: { events: '*', listener: kazoo.webrtc.eventsListener },
						audio_remote: kazoo.audioRemote
					});

					kazoo.webrtc.currentCall.call(destination);
				}
			}
			else if(kazoo.version === 'rtmp') {
				kazoo.rtmp.phone.callProperty('call', 'invite', destination);
			}
		}
	};

	//dtmf should be a character included in this list: '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'.
	kazoo.sendDTMF = function(dtmf) {
		var acceptedDTMF = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'];

		if(acceptedDTMF.indexOf(dtmf) >= 0) {
			if(kazoo.version === 'webrtc') {
				if(kazoo.webrtc.currentCall) {
					kazoo.webrtc.currentCall.dtmf(dtmf);
				}
			}
			else if(kazoo.version === 'rtmp') {
				kazoo.rtmp.phone.callProperty('call', 'sendDTMF', dtmf);
			}
		}
		else {
			console.log('dtmf not supported');
		}
	};

	kazoo.muteMicrophone = function(mute, success, error) {
		if(kazoo.version === 'webrtc') {

			if(kazoo.webrtc.currentCall != null
			&& kazoo.webrtc.currentCall.o_session != null
			&& kazoo.webrtc.currentCall.o_session.o_stream_local != null
			&& kazoo.webrtc.currentCall.o_session.o_stream_local.getAudioTracks().length > 0) {
				for (var nTrack = 0; nTrack < kazoo.webrtc.currentCall.o_session.o_stream_local.getAudioTracks().length ; nTrack++) {
					kazoo.webrtc.currentCall.o_session.o_stream_local.getAudioTracks()[nTrack].enabled = !mute;
					success && success();
				}
			}
			else {
				error && error();
			}
		}
		else if(kazoo.version === 'rtmp') {
			if('phone' in kazoo.rtmp) {
				if(!('originalGain' in kazoo.rtmp)) {
					kazoo.rtmp.originalGain = kazoo.rtmp.phone.getProperty('gain') || 0.5;
				}

				if(mute) {
					kazoo.rtmp.phone.setProperty('gain', 0);
				} else {
					kazoo.rtmp.phone.setProperty('gain', kazoo.rtmp.originalGain);
				}
				success && success();
			} else {
				error && error();
			}
		}
	};

	window.kazoo = kazoo;
}());

