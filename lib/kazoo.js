/*
	Kazoo WebRTC Library v0.2
	Created by Jean-Roch Maitre and Maxime Roux for 2600hz (jr@2600hz.com / max@2600hz.com).
*/

(function() {
	var kazoo = {
			connected: false,
			registered: false,
			params: {}
		},
		privateP = {
			config: {
				paths: {
					SIPjs: 'sip/sip.js'
				}
			},
			manualDisconnect: false,
			videoRemote: undefined,
			userAgent: {},
			calls: {}
		},
		errors = {
			serverNotReachable: {
				key: 'server_not_reachable',
				message: 'Could not reach the server.'
			},
			unauthorized: {
				key: 'unauthorized',
				message: 'Invalid credentials.'
			},
			forbidden: {
				key: 'forbidden',
				message: 'Forbidden.'
			},
			disconnected: {
				key: 'disconnected',
				message: 'You have been disconnected.'
			}
		},
		notifications = {
			overriding: {
				key: 'overriding_registration',
				message: 'You have overridden an existing registration for this device.'
			},
			replaced: {
				key: 'replaced_registration',
				message: 'You have been disconnected: someone else has registered this device.'
			},
			voicemail: {
				key: 'voicemail_notification',
				message: 'You have one or more voicemail message(s).'
			},
			connectivity: {
				key: 'connectivity_notification',
				message: {
					online: 'You have recovered your connection to the network.',
					offline: 'You have lost your connection to the network.'
				},
				status: {
					online: 'online',
					offline: 'offline'
				}
			},
			reconnecting: {
				key: 'reconnecting_notification',
				message: 'Attempting to reconnect...'
			},
			transfered: {
				key: 'transfer_notification',
				message: 'Transfer successful.'
			},
			default: {
				key: 'unknown_notification',
				message: 'You have received a SIP notification.'
			}
		},
		connectivity = {
			isOnline: window.navigator.onLine,
			onlineHistory: [],
			connectivityCallback: function(onlineHistory) {},
			onlineTimerFunction: function() {
				if (window.navigator.onLine !== connectivity.isOnline) {
					connectivity.isOnline = window.navigator.onLine;
					connectivity.onlineHistory.push({
						status: connectivity.isOnline ? notifications.connectivity.status.online : notifications.connectivity.status.offline,
						time: new Date()
					});
					connectivity.connectivityCallback(connectivity.onlineHistory);
				}
			},
			onlineTimer: 0
		};

	function addCall(session) {
		var callId = session.request.call_id,
			interval = setInterval(function() {
				++privateP.calls[callId].duration;
			}, 1000);

		privateP.calls[callId] = {
			callId: callId,
			duration: 0,
			intervals: [ interval ],
			session: session,
			isMuted: false,
			isOnHold: false,
			status: 'ringing',
			getCallerId: function() {
				var callerId = {
					name: session.request.from.displayName,
					number: session.request.from.uri.user
				};

				return callerId;
			}
		};

		bindSessionEvents(privateP.calls[callId].session);
	};

	function acceptCall(callId) {
		privateP.calls[callId].status = 'accepted';
		privateP.calls[callId].acceptedDuration = 0;
		var interval = setInterval(function() {
			++privateP.calls[callId].acceptedDuration;
		}, 1000);
		privateP.calls[callId].intervals.push(interval);
	}

	function removeCall(callId) {
		if (privateP.calls.hasOwnProperty(callId)) {
			for (var i in privateP.calls[callId].intervals) {
				clearInterval(privateP.calls[callId].intervals[i]);
			}

			delete privateP.calls[callId];
		} else {
			console.log('No call to hangup');
		}
	};

	function getActiveCall() {
		var calls = kazoo.listCalls(),
			foundCall,
			firstCall;

		for (var i in calls) {
			if (!firstCall) {
				firstCall = calls[i];
			}

			if (!foundCall && calls[i].status === 'accepted' && !calls[i].isOnHold) {
				foundCall = calls[i];
			}
		}

		if (!foundCall) {
			foundCall = firstCall;
		}

		return foundCall;
	};

	function getActiveCallId() {
		var call = getActiveCall(),
			id;

		if (call) {
			id = call.callId;
		}

		return id;
	};

	function findCallIdInResponse(response) {
		var regex = /Call-ID:\s([^\s]+)/g,
			matches = regex.exec(response),
			callId;

		if (matches.length && matches[1]) {
			callId = matches[1];
		}

		return callId;
	};

	function getSession(callId) {
		var session;

		if (!callId) {
			callId = getActiveCallId();
		}

		if (privateP.calls.hasOwnProperty(callId)) {
			session = privateP.calls[callId].session;
		} else {
			console.log('no valid session for the provided callId');
		}

		return session;
	};

	function holdAllOtherCalls(callId) {
		var calls = privateP.calls;

		if (calls) {
			for (var i in calls) {
				if (calls[i].callId !== callId) {
					kazoo.hold(calls[i].callId);
				}
			}
		}
	};

	function kazooLoadScript(scriptSrc, callback) {
		if (typeof require !== 'undefined') {
			require([ scriptSrc ], function(thing) {
				callback(thing);
			});
		} else {
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
		}
	};

	function bindSessionEvents(session) {
		var sessionCallId = session.request.call_id,
			params = kazoo.params;

		session.on('progress', function(response) {
			console.info('progress', response);
			if (response instanceof SIP.IncomingResponse) {
				params.onConnecting && params.onConnecting();
			}
		});

		session.on('accepted', function(response) {
			var callId = findCallIdInResponse(response);

			if (callId) {
				acceptCall(callId);
			}

			params.onAccepted && params.onAccepted();
		});

		session.on('rejected', function(arg) {
			console.info('rejected', arg);
			if (!params.onCancel) {
				return;
			}
			if (arg) {
				params.onCancel({
					code: arg.status_code,
					message: arg.reason_phrase,
					source: arg
				});
			} else {
				params.onCancel();
			}
		});

		session.on('failed', function(arg) {
			console.info('failed', arg);
		});

		session.on('connecting', function(arg) {
			console.info('connecting', arg);
		});

		session.on('cancel', function() {
			console.info('cancel');

			removeCall(sessionCallId);

			params.onCancel && params.onCancel();
		});

		session.on('refer', function(arg) {
			console.info('refer', arg);
			params.onNotified && params.onNotified({
				key: notifications.transfered.key,
				message: notifications.transfered.message,
				source: arg
			});
		});

		session.on('dtmf', function(arg) {
			console.info('dtmf', arg);
		});

		session.on('muted', function(arg) {
			console.info('muted', arg);
			privateP.calls[sessionCallId].isMuted = true;
		});

		session.on('unmuted', function(arg) {
			console.info('unmuted', arg);
			privateP.calls[sessionCallId].isMuted = false;
		});

		session.on('bye', function(arg) {
			console.info('bye', arg);

			//removeCall(sessionCallId);

			//kazoo.params.onHangup && kazoo.params.onHangup(sessionCallId);
		});

		session.on('hold', function() {
			privateP.calls[sessionCallId].isOnHold = true;

			kazoo.params.onHold && kazoo.params.onHold(sessionCallId);
		});

		session.on('unhold', function() {
			privateP.calls[sessionCallId].isOnHold = false;

			kazoo.params.onUnhold && kazoo.params.onUnhold(sessionCallId);
		});
	};

	function bindCallEvents(call) {
		var callId = call.callId;

		call.hold = function() {
			kazoo.hold(callId);
		};

		call.unhold = function() {
			kazoo.unhold(callId);
		};

		call.hangup = function() {
			kazoo.hangup(callId);
		};

		call.transfer = function(destination) {
			kazoo.transfer(destination, callId);
		};

		call.mute = function() {
			kazoo.mute(callId);
		};

		call.unmute = function() {
			kazoo.unmute(callId);
		};

		call.sendDTMF = function(dtmf) {
			kazoo.sendDTMF(dtmf, callId);
		};
	}

	kazoo.init = function(params) {
		if (params.prefixScripts) {
			for (var i in privateP.config.paths) {
				privateP.config.paths[i] = params.prefixScripts + privateP.config.paths[i];
			}
		}

		if (!window.mozRTCPeerConnection && !navigator.webkitGetUserMedia) {
			console.log('WebRTC not supported');
		} else {
			kazooLoadScript(privateP.config.paths.SIPjs, function(globalVar) {
				if (globalVar) {
					window.SIP = globalVar;
				}

				privateP.videoRemote = document.createElement('video');
				privateP.videoRemote.id = 'kazooVideoRemote';
				privateP.videoRemote.style.display = 'none';
				document.getElementsByTagName('body')[0].appendChild(privateP.videoRemote);

				params.onLoaded && params.onLoaded();
			});
		}
	};

	kazoo.register = function(params) {
		params.reconnectMaxAttempts = isNaN(params.reconnectMaxAttempts) ? -1 : parseInt(params.reconnectMaxAttempts);
		params.reconnectDelay = isNaN(params.reconnectDelay) ? 5 : parseInt(params.reconnectDelay) || 1;
		if (params.reconnectDelay > 60) { params.reconnectDelay = Math.ceil(params.reconnectDelay / 1000); }
		kazoo.params = params;

		privateP.userAgent = new SIP.UA({
			uri: params.publicIdentity,
			rel100: SIP.C.supported.SUPPORTED,
			wsServers: [params.wsUrl],
			authorizationUser: params.privatePIdentity,
			password: params.password,
			traceSip: true,
			wsServerMaxReconnection: params.reconnectMaxAttempts >= 0 ? params.reconnectMaxAttempts : 10,
			wsServerReconnectionTimeout: params.reconnectDelay,
			connectionRecoveryMinInterval: 5
		});

		privateP.userAgent.on('connected', function(arg) {
			kazoo.connected = true;
			console.info('connected', arg);
		});

		privateP.userAgent.on('disconnected', function(arg) {
			if (!kazoo.connected) {
				params.onError && params.onError({
					key: errors.serverNotReachable.key,
					message: errors.serverNotReachable.message,
					source: arg
				});
			} else {
				if (privateP.manualDisconnect) {
					privateP.manualDisconnect = false;
				} else {
					params.onError && params.onError({
						key: errors.disconnected.key,
						message: errors.disconnected.message,
						source: arg
					});
				}
				kazoo.connected = false;
			}
			console.info('disconnected', arg);
		});

		privateP.userAgent.on('registered', function(arg) {
			kazoo.registered = true;
			console.info('registered', arg);
			params.onConnected && params.onConnected();
		});

		privateP.userAgent.on('unregistered', function(arg) {
			kazoo.registered = false;
			console.info('unregistered', arg);
		});

		privateP.userAgent.on('registrationFailed', function(e) {
			console.info('registrationFailed', e);
			var errCode = e ? e.status_code || 0 : 0;
			switch (e.status_code) {
				case 401: //Unauthorized
				case 407: //Proxy Authentication Required
					params.onError && params.onError({
						key: errors.unauthorized.key,
						message: errors.unauthorized.message,
						code: errCode,
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
			}
		});

		privateP.userAgent.on('invite', function(session) {
			var callId = session.request.call_id;

			addCall(session);

			var incomingCall = {
				accept: function() {
					holdAllOtherCalls(callId);

					session.accept({
						media: {
							constraints: {
								audio: true,
								video: false
							},
							render: {
								remote: privateP.videoRemote
							}
						}
					});
				},
				reject: function() {
					session.reject();

					removeCall(callId);
				},
				callerName: session.request.from.displayName,
				callerNumber: session.request.from.uri.user,
				callId: callId
			};

			params.onIncoming && params.onIncoming(incomingCall);
		});

		privateP.userAgent.on('message', function(arg) {
			console.info('message', arg);
		});

		privateP.userAgent.on('notify', function(arg) {
			console.info('notify', arg);
			var notificationType = arg.body.substring(0, arg.body.indexOf(':')),
				notification = {};

			switch (notificationType) {
				case 'Overwrote': {
					notification = {
						key: notifications.overriding.key,
						message: notifications.overriding.message
					};
					break;
				}
				case 'Replaced-By': {
					notification = {
						key: notifications.replaced.key,
						message: notifications.replaced.message
					};
					break;
				}
				case 'Message-Account': {
					notification = {
						key: notifications.voicemail.key,
						message: notifications.voicemail.message
					};
					break;
				}
				default: {
					notification = {
						key: notifications.default.key,
						message: notifications.default.message
					};
				}
			}
			notification.source = arg;
			params.onNotified && params.onNotified(notification);
		});

		if (typeof params.onNotified === 'function') {
			connectivity.connectivityCallback = function(onlineHistory) {
				var notification = {
					key: notifications.connectivity.key,
					message: notifications.connectivity.message[onlineHistory[onlineHistory.length - 1].status],
					status: onlineHistory[onlineHistory.length - 1].status,
					time: onlineHistory[onlineHistory.length - 1].time,
					history: onlineHistory
				};
				params.onNotified(notification);
			};
		}
	};

	kazoo.logout = function() {
		privateP.manualDisconnect = true;
		privateP.userAgent.stop();

		for (var i in privateP.calls) {
			removeCall(privateP.calls[i].callId);
		}

		connectivity.connectivityCallback = function(onlineHistory) {};
	};

	//Destination should be a sip address like: sip:1234@realm.com
	kazoo.connect = function(destination) {
		if (destination) {
			var session = privateP.userAgent.invite(destination, {
				media: {
					constraints: {
						audio: true,
						video: false
					},
					render: {
						remote: privateP.videoRemote
					}
				}
			});

			addCall(session);
		}
	};

	kazoo.hangup = function(callId) {
		var session = getSession(callId);

		if (session) {
			if (session.dialog) {
				session.bye();
			} else {
				session.cancel();
			}

			removeCall(callId);

			kazoo.params.onHangup && kazoo.params.onHangup(callId);
		} else {
			console.log('callId not found');
		}
	};

	kazoo.hold = function(callId) {
		var callId = callId || getActiveCallId(),
			session = getSession(callId);

		if (session.isOnHold().local === false) {
			session.hold();

			privateP.calls[callId].isOnHold = true;

			kazoo.params.onHold && kazoo.params.onHold(callId);
		}
	};

	kazoo.unhold = function(callId) {
		var callId = callId || getActiveCallId(),
			session = getSession(callId);

		if (session.isOnHold().local === true) {
			session.unhold();

			privateP.calls[callId].isOnHold = false;

			kazoo.params.onUnhold && kazoo.params.onUnhold(callId);
		}
	};

	kazoo.transfer = function(destination, callId) {
		var session = getSession(callId);

		if (session) {
			session.refer(destination);

			kazoo.params.onTransfer && kazoo.params.onTransfer(callId);
		}
	};

	//dtmf should be a character included in this list: '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'.
	kazoo.sendDTMF = function(dtmf, callId) {
		var acceptedDTMF = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'],
			session = getSession(callId);

		if (session) {
			if (acceptedDTMF.indexOf(dtmf) >= 0) {
				session.dtmf(dtmf);
			} else {
				console.log('dtmf not supported');
			}
		}
	};

	kazoo.mute = function(callId) {
		var callId = callId || getActiveCallId(),
			session = getSession(callId);

		privateP.calls[callId].isMuted = true;

		session.mute();
	};

	kazoo.unmute = function(callId) {
		var callId = callId || getActiveCallId(),
			session = getSession(callId);

		privateP.calls[callId].isMuted = false;

		session.unmute();
	};

	kazoo.listCalls = function() {
		var publicCalls = [],
			call;

		for (var i in privateP.calls) {
			call = {
				callId: i,
				isMuted: privateP.calls[i].isMuted,
				isOnHold: privateP.calls[i].isOnHold,
				duration: privateP.calls[i].duration,
				acceptedDuration: privateP.calls[i].acceptedDuration,
				callerIdName: privateP.calls[i].getCallerId().name,
				callerIdNumber: privateP.calls[i].getCallerId().number,
				status: privateP.calls[i].status
			};

			bindCallEvents(call);

			publicCalls.push(call);
		}

		return publicCalls;
	};

	kazoo.getActiveCall = function() {
		return getActiveCall();
	};

	/*kazoo.startAutoReconnect = function() {
		if (!kazoo.isReconnecting && 'params' in kazoo) {
			kazoo.isReconnecting = true;
			kazoo.reconnectAttempt = 0;

			setTimeout(function() {
				if (kazoo.isReconnecting) {
					kazoo.reconnect();
				}
			}, kazoo.reconnectDelay);
		}
	};

	kazoo.stopAutoReconnect = function() {
		kazoo.isReconnecting = false;
	};*/

	kazoo.reconnect = function() {
		try {
			kazoo.logout();
		} finally {
			kazoo.params.onNotified({
				key: notifications.reconnecting.key,
				message: notifications.reconnecting.message,
				attempt: kazoo.reconnectAttempt + 1
			});
			setTimeout(function() { kazoo.register(kazoo.params); }, 1000);
		}
	};

	kazoo.monitorConnectivity = function(enabled) { //True by default
		if (enabled === false) {
			clearInterval(connectivity.onlineTimer);
			connectivity.onlineTimer = 0;
		} else if (connectivity.onlineTimer === 0) {
			connectivity.onlineTimer = setInterval(connectivity.onlineTimerFunction, 100);
		}
	};

	kazoo.getConnectivityHistory = function() {
		return connectivity.onlineHistory;
	};

	window.kazoo = kazoo;

	kazoo.monitorConnectivity(true);
}());
