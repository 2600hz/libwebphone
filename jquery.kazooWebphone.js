;(function ($, window, document) {
    'use strict';

    var namespace   = 'kazoo',
        widgetName  = 'webphone',
        fullName    = namespace.concat('.', widgetName),

        defaults    = {
            disabled    : false,
            hide        : null,
            show        : null
        },

        options     = {
            apiUrl: 'http://10.26.0.81:8000/v2/',
            websocketUrl: 'ws://10.26.0.81:8080',
            rtmpUrl: 'rtmp://10.26.0.81/sip',
            volume: {
                range   : 'min',
                value   : 25,
                min     : 0,
                max     : 100
            },
            actions: {
                mute        : { classIcon: 'fa fa-microphone-slash' },
                transfer    : { classIcon: 'fa fa-exchange' }
            },
            dialpad: [
                { text: '1'                 , value: '1' },
                { text: '2', legend: 'abc'  , value: '2' },
                { text: '3', legend: 'def'  , value: '3' },
                { text: '4', legend: 'ghi'  , value: '4' },
                { text: '5', legend: 'jkl'  , value: '5' },
                { text: '6', legend: 'mno'  , value: '6' },
                { text: '7', legend: 'pqrs' , value: '7' },
                { text: '8', legend: 'tuv'  , value: '8' },
                { text: '9', legend: 'wxyz' , value: '9' },
                { text: '*'                 , value: '*' },
                { text: '0'                 , value: '0' },
                { text: '#'                 , value: '#' },
            ],
            i18n: {
                actions: {
                    call: 'Call',
                    mute: 'MUTE',
                    unmute: 'UNMUTE',
                    hangup: 'Hang Up',
                    transfer: 'Transfer',
                    transferCall: 'Transfer Call'
                },
                loginPopup: {
                    legend: 'Access your webphone',
                    label: {
                        username: 'Username',
                        password: 'Password',
                        accountName: 'Account Name'
                    },
                    button: {
                        login: 'Login'
                    }
                },
                phoneDialer: {
                    button: {
                        connect: 'Call',
                        hangup: 'Hang Up'
                    }
                },
                cancel: 'Cancel'
            }
        },

        widget      = {

            options: $.extend(true, {}, defaults, options),

            _create: function _create () {
                var self = {
                        document            : this.document,
                        element             : this.element,
                        namespace           : this.namespace,
                        options             : this.options,
                        uuid                : this.uuid,
                        version             : this.version,
                        widgetEventPrefix   : this.widgetEventPrefix,
                        widgetFullName      : this.widgetFullName,
                        widgetName          : this.widgetName,
                        window              : this.window,

                        // _delay              : this._delay(),
                        _destroy            : this._destroy(),
                        _focusable          : this._focusable(),
                        _getCreateEventData : this._getCreateEventData(),
                        _getCreateOptions   : this._getCreateOptions(),
                        // _hide               : this._hide(),
                        _hoverable          : this._hoverable(),
                        _init               : this._init(),
                        // _off                : this._off(),
                        // _on                 : this._on(),
                        _setOption          : this._setOption(),
                        _setOptions         : this._setOptions(),
                        _super              : this._super(),
                        _superApply         : this._superApply(),
                        _trigger            : this._trigger(),
                        destroy             : this.destroy(),
                        disable             : this.disable(),
                        enable              : this.enable(),
                        // instance            : this.instance(),
                        option              : this.option(),
                        widget              : this.widget()
                    };

                this._initKazoo();
                this._render();
                this._bindEvents();
            },

            _render: function _render () {
                var self = this,
                    htmlPhoneDialer         = $('<div>').addClass('phone-dialer'),
                    htmlPhoneHeader         = $('<div>').addClass('phone-header'),
                    htmlDialpadContainer    = $('<div>').addClass('dialpad-container'),
                    htmlCallActions         = $('<div>').addClass('call-actions'),
                    htmlPhoneOptions        = $('<div>').addClass('phone-options'),
                    htmlOptionsContainer    = $('<div>').addClass('options-container'),
                    htmlVolumeContainer     = $('<div>').addClass('volume-container'),
                    htmlLoginPopup          = $('<div>').addClass('popup-container'),
                    i18n = self.options.i18n;

                htmlVolumeContainer
                    .append(
                        $('<div>')
                            .addClass('volume-icons')
                            .append(
                                $('<i>')
                                    .addClass('fa fa-volume-down'),
                                $('<i>')
                                    .addClass('fa fa-volume-up')
                            ),
                        $('<div>')
                            .addClass('volume-control')
                            .slider(self.options.volume)
                    );

                if (self.options.actions !== null) {
                    $.each(self.options.actions, function(k, v) {
                        if (v !== null) {
                            var button = $('<button>');

                            button
                                .addClass('btn btn-secondary option-item')
                                .data('action', k)
                                .append(
                                    $('<i>')
                                        .addClass(v.classIcon.concat(' ', 'item-icon'))
                                        .data('action', k),
                                    $('<span>')
                                        .addClass('item-text')
                                        .text(i18n.actions[k].toUpperCase())
                                );

                            htmlOptionsContainer
                                .append(button);
                        }
                    });

                    htmlPhoneOptions
                        .append(htmlOptionsContainer);
                }

                if (self.options.volume !== null) {
                    htmlPhoneOptions
                        .append(htmlVolumeContainer);

                    self.volume = {
                        element: htmlVolumeContainer.find('.volume-control'),
                        value: self.options.volume.value
                    };
                }

                htmlCallActions
                    .append(
                        $('<button>')
                            .addClass('btn btn-success')
                            .prop('id', 'call_action')
                            .text(i18n.phoneDialer.button.connect)
                            .data('action', 'connect')
                    );

                self.options.dialpad.forEach(function(v) {
                    var button = $('<button>');

                    button
                        .addClass('dialpad-item')
                        .data('dtmf', v.value);

                    if (v.hasOwnProperty('text')) {
                        button
                            .append(
                                $('<span>')
                                    .addClass('item-text')
                                    .text(v.text)
                            );
                    }

                    if (v.hasOwnProperty('legend')) {
                        button
                            .append(
                                $('<span>')
                                    .addClass('item-legend')
                                    .text(v.legend.toUpperCase())
                            );
                    }

                    htmlDialpadContainer
                        .append(button);
                });

                htmlPhoneHeader
                    .append(
                        $('<div>')
                            .addClass('call-tray')
                            .append(
                                $('<i>')
                                    .addClass('fa fa-microphone-slash')
                                    .data('action', 'mute')
                            ),
                        $('<div>')
                            .addClass('call-info'),
                        $('<div>')
                            .addClass('dialbox-container')
                            .append(
                                $('<input>')
                                    .addClass('dialbox')
                                    .prop('type', 'tel'),
                                $('<i>')
                                    .addClass('fa fa-caret-left dialbox-icon')
                            )
                    );

                htmlPhoneDialer
                    .append(htmlPhoneHeader);

                if (self.options.actions.transfer !== null) {
                    htmlPhoneDialer
                        .append($('<div>').addClass('transfer-container')
                                    .append(
                                        $('<div>')
                                            .addClass('call-info')
                                            .text('TRANSFER TO'),
                                        $('<div>')
                                            .addClass('dialbox-container')
                                            .append(
                                                $('<input>')
                                                    .addClass('dialbox')
                                                    .prop('type', 'tel'),
                                                $('<i>')
                                                    .addClass('fa fa-caret-left dialbox-icon')
                                            )
                                    )
                        );
                }

                htmlPhoneDialer
                    .append(
                        htmlDialpadContainer,
                        htmlCallActions
                    );


                htmlLoginPopup
                    .append(
                        $('<form>')
                            .addClass('popup login-form')
                            .append(
                                $('<fieldset>')
                                    .append(
                                        $('<legend>')
                                            .text(i18n.loginPopup.legend),
                                        $('<div>')
                                            .addClass('control-group')
                                            .append(
                                                $('<label>')
                                                    .addClass('control-label')
                                                    .prop('for', 'username')
                                                    .text(i18n.loginPopup.label.username),
                                                $('<div>')
                                                    .addClass('controls')
                                                    .append(
                                                        $('<input>')
                                                            .prop({
                                                                id: 'username',
                                                                type: 'text',
                                                                name: 'username',
                                                                maxlength: 128
                                                            })
                                                    )
                                            ),
                                        $('<div>')
                                            .addClass('control-group')
                                            .append(
                                                $('<label>')
                                                    .addClass('control-label')
                                                    .prop('for', 'password')
                                                    .text(i18n.loginPopup.label.password),
                                                $('<div>')
                                                    .addClass('controls')
                                                    .append(
                                                        $('<input>')
                                                            .prop({
                                                                id: 'password',
                                                                type: 'password',
                                                                name: 'password'
                                                            })
                                                    )
                                            ),
                                        $('<div>')
                                            .addClass('control-group')
                                            .append(
                                                $('<label>')
                                                    .addClass('control-label')
                                                    .prop('for', 'account_name')
                                                    .text(i18n.loginPopup.label.accountName),
                                                $('<div>')
                                                    .addClass('controls')
                                                    .append(
                                                        $('<input>')
                                                            .prop({
                                                                id: 'account_name',
                                                                type: 'text',
                                                                name: 'account_name',
                                                            })
                                                    )
                                            )
                                    ),
                                $('<div>')
                                    .addClass('actions')
                                    .append(
                                        $('<button>')
                                            .addClass('btn btn-success login')
                                            .text(i18n.loginPopup.button.login)
                                    )
                            ),
                        $('<i>')
                            .addClass('fa fa-spinner fa-spin spinner')
                    );

                self.element
                    .append(htmlPhoneDialer);

                if (self.options.volume !== null || self.options.actions !== null) {
                    self.element
                        .addClass('has-actions')
                        .append(htmlPhoneOptions);
                }

                self.element
                    .append(htmlLoginPopup);

                this.timer = new Stopwatch(htmlPhoneHeader.find('.call-info'));

                $.extend(true, self, {
                    transfer    : { element:      htmlPhoneDialer.find('.transfer-container .dialbox')  , value: '' },
                    dialbox     : { element:      htmlPhoneDialer.find('.phone-header .dialbox')        , value: '' },
                    callActions : { element:     htmlPhoneOptions.find('.options-container') },
                    dialpad     : { element: htmlDialpadContainer },
                    loginPopup  : { element:       htmlLoginPopup }
                });
            },

            _onDtmfClick: function _onDtmfClick (event) {
                var key = $(event.currentTarget).data('dtmf');

                if (this.transfer.element.is(':visible')) {
                    var transferValue = this.transfer.element.val(),
                        newTransferValue = transferValue.concat(key);

                    this.transfer.element
                        .val(newTransferValue)
                        .focus();

                    this.transfer.value = newTransferValue;
                }
                else {
                    var callValue = this.dialbox.element.val(),
                        newCallValue = callValue.concat(key);

                    this.dialbox.element
                        .val(newCallValue)
                        .focus();

                    this.dialbox.value = newCallValue;

                    if (!this.element.find('.call-info').is(':empty')) {
                        kazoo.sendDTMF(key);
                    }
                }
            },

            _onCallDialboxValueChange: function _onCallDialboxValueChange () {
                this.dialbox.value = this.dialbox.element.val();
            },

            _onTransferDialboxValueChange: function _onTransferDialboxValueChange () {
                this.transfer.value = this.transfer.element.val();
            },

            _onDialboxBackspaceClick: function _onDialboxBackspaceClick () {
                var newValue = this.dialbox.element.val().slice(0, -1);

                this.dialbox.element
                    .val(newValue)
                    .focus();

                this.dialbox.value = newValue;
            },

            _onTrasnferBackspaceClick: function _onTrasnferBackspaceClick () {
                var newValue = this.transfer.element.val().slice(0, -1);

                this.transfer.element
                    .val(newValue)
                    .focus();

                this.transfer.value = newValue;
            },

            _onCallOptionClick: function _onCallOptionClick (event) {
                var action = $(event.currentTarget).data('action');

                if (action === 'mute') {
                    this._toggleMute();
                }
                else if (action === 'transfer') {
                    this._toggleTransfer();
                }
            },

            _onVolumeChange: function _onVolumeChange () {
                this.volume.value = ui.value;
            },

            _onCallActionClick: function _onCallActionClick (event) {
                var target = $(event.currentTarget),
                    action = target.data('action');

                if (action === 'connect') {
                    var connectParams = {
                            username: this.dialbox.value,
                            realm: 'webdev.realm'
                        };

                    kazoo.connect(this._generatePublicIdentity(connectParams));

                    this.timer.start();

                    target
                        .toggleClass('btn-success btn-danger')
                        .data('action', 'hangup')
                        .text(this.options.i18n.phoneDialer.button.hangup);
                }
                else if (action === 'transfer') {
                    var transferParams = {
                            username: this.transfer.value,
                            realm: 'webdev.realm'
                        };

                    kazoo.transfer(this._generatePublicIdentity(transferParams));

                    target
                        .toggleClass('btn-success btn-danger')
                        .data('action', 'hangup')
                        .text(this.options.i18n.phoneDialer.button.hangup);
                }
                else {
                    kazoo.hangup();
                }
            },

            _onLoginClick: function _onLoginClick (event) {
                event.preventDefault();

                var self = this,
                    formData = self._getFormData('.login-form'),
                    hash = md5(formData.username + ':' + formData.password);

                self._request({
                        url: 'user_auth',
                        type: 'PUT',
                        data: {
                            data: {
                                credentials: hash,
                                account_name: formData.account_name
                            }
                        }
                    },
                    function (authData) {
                        var ownerId = authData.owner_id,
                            accountId = authData.account_id;

                        self._request({
                                url: 'accounts/' + accountId + '/devices',
                                type: 'GET',
                                data: {
                                    filter: {
                                        'filter_webphone.source': 'webphone-plugin',
                                        'filter_owner_id': ownerId
                                    }
                                }
                            },
                            function (devicesData) {
                                self.loginPopup.element
                                    .find('.login-form')
                                        .fadeOut(200, function() {
                                            self.loginPopup.element
                                                .find('.spinner')
                                                    .fadeIn(200, function () {
                                                        self._request({
                                                                url: 'accounts' + '/' + accountId,
                                                                type: 'GET'
                                                            },
                                                            function (accountData) {
                                                                if (devicesData.length) {
                                                                    self._request({
                                                                            url: 'accounts/' + accountId + '/devices/' + devicesData[0].id,
                                                                            type: 'GET'
                                                                        },
                                                                        function (deviceData) {
                                                                            self.element
                                                                                .removeClass('blur');

                                                                            self._registerWebphone({
                                                                                username: deviceData.sip.username,
                                                                                password: deviceData.sip.password,
                                                                                realm: accountData.realm
                                                                            });
                                                                        }
                                                                    );
                                                                }
                                                                else {
                                                                    self._request({
                                                                            url: 'accounts/' + accountId + '/devices',
                                                                            type: 'PUT',
                                                                            data: {
                                                                                accept_charges: true,
                                                                                data: {
                                                                                    owner_id: ownerId,
                                                                                    device_type: 'softphone',
                                                                                    name: 'Webphone Plugin Device',
                                                                                    sip: {
                                                                                        username: 'user_' + self._randomString(10),
                                                                                        password: self._randomString(12)
                                                                                    },
                                                                                    webphone: {
                                                                                        source: 'webphone-plugin'
                                                                                    }
                                                                                }
                                                                            }
                                                                        },
                                                                        function (deviceData) {
                                                                            self.element
                                                                                .removeClass('blur');

                                                                            self._registerWebphone({
                                                                                username: deviceData.sip.username,
                                                                                password: deviceData.sip.password,
                                                                                realm: accountData.realm
                                                                            });
                                                                        }
                                                                    );
                                                                }
                                                            }
                                                        );
                                                    });
                                        });
                            }
                        );
                    }
                );
            },

            _bindEvents: function _bindEvents () {
                var self = this,
                    eventsList = {
                        _onDtmfClick                    : { target: self.dialpad.element.children()         , event: 'click' },
                        _onCallDialboxValueChange       : { target: self.dialbox.element                    , event: 'change' },
                        _onTransferDialboxValueChange   : { target: self.transfer.element                   , event: 'change' },
                        _onDialboxBackspaceClick        : { target: self.dialbox.element.siblings()         , event: 'click' },
                        _onCallOptionClick              : { target: self.callActions.element.children()     , event: 'click' },
                        _onVolumeChange                 : { target: self.callActions.element                , event: 'slidechange' },
                        _onCallActionClick              : { target: self.element.find('#call_action')       , event: 'click' },
                        _onLoginClick                   : { target: self.loginPopup.element.find('.login')  , event: 'click' }
                    },
                    eventsState = {
                        _onVolumeChange     : self.options.volume,
                        _onCallOptionClick  : self.options.actions
                    };

                $.each(eventsState, function(k, v) {
                    if (v === null) {
                        delete eventsList[k];
                    }
                });

                $.each(eventsList, function(k, v) {
                    var handler = {};
                    handler[v.event] = k;
                    self._on(v.target, handler);
                });
            },

            _getFormData: function _getFormData (selector) {
                return this.element.find(selector).serializeArray().reduce(function(p, c) {
                    p[c.name] = c.value;
                    return p;
                }, {});
            },

            _request: function _request (settings, callbackSuccess, callbackError) {
                var self = this,
                    resource = settings.url,
                    defaultSettings = {
                        dataType: 'json',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    };

                settings = $.extend(true, {}, defaultSettings, settings);

                if (resource !== 'user_auth') {
                    settings.headers['X-Auth-Token'] = Cookies.get('X-Auth-Token');
                }

                if (settings.hasOwnProperty('data')) {
                    if (settings.data.hasOwnProperty('filter')) {
                        settings.url += '?';

                        $.each(settings.data.filter, function(filter, value) {
                            if (settings.url.slice(-1) !== '?') {
                                settings.url += '&';
                            }

                            settings.url += filter + '=' + value;
                        });

                        delete settings.data.filter;
                    }

                    settings.data = JSON.stringify(settings.data);
                }

                settings.url = self.options.apiUrl + settings.url;

                $.ajax(
                    settings
                )
                .done(function(data, textStatus, jqXHR) {
                    if (resource === 'user_auth' && data.hasOwnProperty('auth_token')) {
                        Cookies.set('X-Auth-Token', data.auth_token);
                    }

                    callbackSuccess && callbackSuccess(data.data);
                })
                .fail(function(data, textStatus, jqXHR) {
                    callbackError && callbackError();
                });
            },

            _initKazoo: function _initKazoo () {
                var paramsInit = {
                        forceRTMP: false,
                        flashContainer: 'flash_div',
                        onLoaded: function onLoaded () {
                            console.log('onLoaded');
                        },
                        onFlashMissing: function onFlashMissing (container) {
                            console.log('onFlashMissing');
                        }
                    };

                kazoo.init(paramsInit);
            },

            _onAccepted: function _onAccepted () {

                console.log('onAccepted');
            },

            _onConnected: function _onConnected () {

                console.log('onConnected');
            },

            _onHangup: function _onHangup () {
                this.webphone.timer.reset();
                $('#call_action')
                        .toggleClass('btn-danger btn-success')
                        .data('action', 'connect')
                        .text('Call');

                console.log('onHangup');
            },

            _onIncoming: function _onIncoming (call) {
                var self = this,
                    caller = call.callerName + (call.callerNumber ? '(' + call.callerNumber + ')' : ''),
                    popupTemplate = $('<div>')
                                        .addClass('popup incoming')
                                        .append(
                                            $('<div>')
                                                .addClass('incoming-info')
                                                .text(caller + ' is calling you!'),
                                            $('<div>')
                                                .addClass('actions')
                                                .append(
                                                    $('<button>')
                                                        .addClass('btn cancel')
                                                        .text('Cancel'),
                                                    $('<button>')
                                                        .addClass('btn btn-success pickup')
                                                        .text('Pick up')
                                                )
                                        );

                popupTemplate
                    .find('button')
                        .on('click', function() {
                            if (!self.webphone.element.find('.call-info').is(':empty')) {
                                kazoo.hangup();
                            }
                            self.webphone.element.find('.incoming').remove();
                            self.webphone.element.find('.popup-container').hide();

                            if ($(this).hasClass('pickup')) {
                                self.webphone.timer.start();
                                self.webphone.element
                                    .find('#call_action')
                                        .toggleClass('btn-success btn-danger')
                                        .data('action', 'hangup')
                                        .text(self.webphone.options.i18n.phoneDialer.button.hangup);
                                call.accept();
                            }
                            else {
                                call.reject();
                            }
                        });

                self.webphone.element
                    .find('.popup-container i')
                        .hide();

                self.webphone.element
                    .find('.popup-container')
                        .show()
                        .append(popupTemplate);

                console.log('onIncoming', call);
            },

            _onCancel: function _onCancel () {
                this.webphone.timer.reset();
                this.webphone.element.find('.incoming').remove();
                this.webphone.element.find('.popup-container').hide();
                this.webphone.element
                    .find('#call_action')
                        .prop('class', 'btn btn-success')
                        .data('action', 'connect')
                        .text('Call');

                console.log('onCancel');
            },

            _onTransfer: function _onTransfer () {
                this.webphone.timer.restart();
                this.webphone._toggleTransfer();
                this.webphone.dialbox.element.val(this.webphone.transfer.value);
                this.webphone.element.find('#call_action')
                    .prop('class', 'btn btn-hangup')
                    .data('action', 'hangup')
                    .text(this.webphone.options.i18n.phoneDialer.button.hangup);

                console.log('onTransfer');
            },

            _onNotified: function _onNotified (notification) {

                console.log('onNotified', notification);
            },

            _onError: function _onError () {

                console.log('onError');
            },

            _registerWebphone: function _registerWebphone (params) {
                var self = this,
                    registerParams  = {
                        webphone               : self,
                        forceRTMP               : true,
                        wsUrl                   : self.options.websocketUrl,
                        rtmpUrl                 : self.options.rtmpUrl,
                        realm                   : params.realm,
                        privateIdentity         : params.username,
                        publicIdentity          : self._generatePublicIdentity(params),
                        password                : params.password,
                        onAccepted              : self._onAccepted,
                        onConnected             : self._onConnected,
                        onHangup                : self._onHangup,
                        onIncoming              : self._onIncoming,
                        onCancel                : self._onCancel,
                        onTransfer              : self._onTransfer,
                        onNotified              : self._onNotified,
                        onError                 : self._onError,
                        reconnectMaxAttempts    : 3,
                        reconnectDelay          : 10000
                    };

                kazoo.register(registerParams);
            },

            _generatePublicIdentity: function _generatePublicIdentity (params) {
                return 'sip:' + params.username + '@' + params.realm;
            },

            _randomString: function _randomString (length, pChars) {
                var chars = pChars || '23456789abcdefghjkmnpqrstuvwxyz',
                    randomString = '';

                for (var i = length; i > 0; i--) {
                    randomString += chars.charAt(Math.floor(Math.random() * chars.length));
                }

                return randomString;
            },

            _toggleMute: function _toggleMute () {
                var self = this,
                    i18n = self.options.i18n,
                    icon = self.element.find('.call-tray i'),
                    isMuted = icon.is(':visible');

                kazoo.muteMicrophone(!isMuted, function () {
                    self.element.find('.options-container .option-item').each(function(idx, el) {
                        el = $(el);
                        if (el.data('action') === 'mute') {
                            el.find('.item-text')
                                .text(isMuted ? i18n.actions.mute : i18n.actions.unmute);
                            el.toggleClass('active');
                        }
                        icon['fade'.concat(isMuted ? 'Out' : 'In')](200);
                    });
                }, function () {
                    console.log('mute error: no call in progress');
                });

            },

            _toggleTransfer: function _toggleTransfer () {
                var self = this,
                    i18n = self.options.i18n,
                    container = self.element.find('.transfer-container'),
                    actions = self.element.find('.call-actions'),
                    isVisible = container.is(':visible'),
                    isCalling = !self.element.find('.call-info').is(':empty');

                self.element
                    .find('.options-container .option-item[data-action="transfer"]')
                        .toggleClass('active');

                container['slide'.concat(container.is(':visible') ? 'Up' : 'Down')]();

                if (isVisible) {
                    actions.find('#cancel_transfer')
                        .fadeOut(200, function() {
                            $(this).remove();

                            actions.find('#call_action')
                                .text(isCalling ? i18n.actions.hangup : i18n.actions.call)
                                .data('action', isCalling ? 'hangup' : 'connect')
                                .prop('class', isCalling ? 'btn btn-danger' : 'btn btn-success')
                                .animate({
                                    width: '100%'},
                                    200, function() {
                                    $(this)
                                        .css('float', 'none');
                                });
                        });
                }
                else {
                    actions
                        .append(
                            $('<button>')
                                .text(i18n.cancel)
                                .css({
                                    width: '140px',
                                    display: 'none'
                                })
                                .addClass('btn')
                                .prop('id', 'cancel_transfer')
                                .on('click', function() {
                                    self._toggleTransfer();
                                })
                        );

                    actions.find('#call_action')
                        .text(i18n.actions.transferCall)
                        .css('float', 'right')
                        .data('action', 'transfer')
                        .prop('class', 'btn btn-success')
                        .animate({
                            width: '200px'},
                            200, function() {
                            actions
                                .find('#cancel_transfer')
                                    .fadeIn(200);
                        });
                }
            }

        };

        var Stopwatch = function(elem) {
            var clock,
                interval;

            function getClockTime (pSeconds) {
                var format2Digits = function format2Digits (number) {
                        return number < 10 ? '0'.concat(number) : number;
                    },
                    seconds = pSeconds % 60,
                    minutes = Math.floor(pSeconds / 60) % 60,
                    hours = Math.floor(pSeconds / 60 / 60),
                    output = format2Digits(minutes) + ':' + format2Digits(seconds);

                if (hours > 0) {
                    output = format2Digits(hours) + ':' + output;
                }

                return output;
            }

            function start () {
                interval = setInterval(function () {
                    ++clock;
                    elem.text(getClockTime(clock));
                }, 1000);
                console.log('start timer');
            }

            function restart () {
                clock = 0;
                start();
            }

            function reset () {
                clock = 0;
                clearInterval(interval);
                elem.empty();
                console.log('reset timer');
            }

            reset();

            this.start      = start;
            this.restart    = restart;
            this.reset      = reset;
        };

    $.widget(fullName, widget);

})(jQuery, window, document);
