try {
    var cX = window.cX = window.cX || {};
    cX.callQueue = cX.callQueue || [];
    cX.CCE = cX.CCE || {};
    cX.CCE.callQueue = cX.CCE.callQueue || [];

    if (!cX.CCE.library) {
        cX.CCE.library = {
            version: "2.36",
            ccePushUrl: 'https://comcluster.cxense.com/cce/push?callback={{callback}}',
            prefix: null,
            persistedQueryId: null,
            testGroup: -1,
            testVariant: null,
            previewTestId: null,
            previewCampaign: null,
            previewDiv: null,
            previewId: null,
            offerProductId: null,
            startTime: new Date(),
            visibilityField: 'timeHalf',
            trackTime: 0.5,
            noCache: false,
            activeSnapPoint: null,
            snapPoints: [],
            activeWidgets: [],
            '__cx-toolkit__': {
                isShown: false,
                data: []
            },
            utmParams: [],

            sendPageViewEvent: function(prefix, persistedQueryId, args, callback) {
                this.init(null, prefix, persistedQueryId, this.visibilityField, function() {
                    cX.sendPageViewEvent(args, callback);
                });
            },

            init: function(scriptPattern, prefix, persistedQueryId, visibilityField, callback) {
                this.prefix = prefix;
                this.persistedQueryId = persistedQueryId;

                var params = {};

                if (scriptPattern) {
                    var scripts = document.getElementsByTagName('script');
                    var script = null;
                    for (var i = 0; !script && (i < scripts.length); ++i) {
                        if (scripts[i] && scripts[i].src && scripts[i].src.indexOf(scriptPattern) > -1) {
                            script = scripts[i];
                        }
                    }
                    if (script && script.src && (script.src.indexOf('#') > -1)) {
                        var searchPart = script.src.replace(/.*#/, '');
                        params = cX.decodeUrlEncodedNameValuePairs(searchPart);
                    }
                }

                var args = cX.parseUrlArgs();
                cX.Object.forEach(args, cX.createDelegate(this, function(value, key) {
                    if (value !== undefined && key.match(/utm_(source|medium|content|campaign|term)/i)) {
                        this.utmParams.push({key: key, value: value});
                    }
                }));
                this.testVariant = args.testVariant || params.testVariant || params.ver;
                this.previewTestId = args.testId || params.testId;
                this.previewCampaign = args.previewCampaign || params.previewCampaign;
                this.previewDiv = args.previewDiv || params.previewDiv || 'current';
                this.previewId = args.previewId || params.previewId;
                this.offerProductId = args.cx_productId || params.cx_productId;
                this.noCache = args.cx_nocache === '1' || params.cx_nocache === '1';
                if (this.testGroup === -1) {
                    this.testGroup = this.getTestGroup();
                }

                if (this.prefix && this.persistedQueryId) {
                    cX.setEventAttributes({origin: this.prefix + '-web', persistedQueryId: this.persistedQueryId});
                }
                cX.setCustomParameters({ver: this.version, testGroup: this.testGroup});

                if (visibilityField && visibilityField.length) {
                    this.visibilityField = visibilityField;
                }

                if (this.startTime) {
                    var delay = (new Date() - this.startTime) / 1000;
                    if (delay > 2.0) {
                        cX.setCustomParameters({loadDelay: delay.toFixed(1)});
                    }
                    this.startTime = null; // The page is loaded
                }
                if (location.protocol === 'http:') {
                    cX.setCustomParameters({insecure: 'y'});
                }
                this._insertPreview();

                var showTools = this._parseSavedParameter('showTools', args, params);

                if (showTools) {
                    var useLocal = this._parseSavedParameter('useLocalToolkit', args, params);

                    this._showTools(useLocal);
                }

                if (callback) {
                    callback();
                }
            },

            _parseSavedParameter: function(paramName, args, params) {
                var storageKey = '_cX_' + paramName;
                var isParameterChanged = args[paramName] !== undefined || params[paramName] !== undefined;
                var isParameterSet = args[paramName] === '1' || params[paramName] === '1';
                if (isParameterChanged) {
                    localStorage.setItem(storageKey, isParameterSet ? '1' : '0');
                } else {
                    isParameterSet = localStorage.getItem(storageKey) === '1';
                }

                return isParameterSet;
            },

            setVisibilityField: function(visibilityField) {
                this.visibilityField = visibilityField;
            },

            setSnapPoints: function(viewPorts) {
                this.snapPoints = viewPorts;
                this.activeSnapPoint = this._getSnapPoint();
                var t;
                window.addEventListener('resize', cX.createDelegate(this, function() {
                    clearTimeout(t);
                    t = setTimeout(cX.createDelegate(this, function() {
                        this._renderResizedWidgets();
                    }), 200);
                }), false);
            },

            _getSnapPoint: function() {
                var v = this.snapPoints;
                if (!v.length) {
                    return '';
                }
                var width = cX.getWindowSize().width;
                for (var i = 0; i < v.length; ++i) {
                    if (width >= v[i].min) {
                        return v[i].name;
                    }
                }
                return v[v.length - 1].name;
            },

            _renderResizedWidgets: function() {
                var newSnap = this._getSnapPoint();
                if (newSnap !== this.activeSnapPoint) {
                    this.activeSnapPoint = newSnap;
                    for (var i = 0; i < this.activeWidgets.length; ++i) {
                        var w = this.activeWidgets[i];
                        w.context.activeSnapPoint = newSnap;
                        var element = document.getElementById(w.templateId);
                        if (!element) {
                            this._addTemplate(w.templateId, w.templateContent);
                        }
                        cX.renderTemplate(w.templateId, w.targetId, w.data, w.context);
                    }
                }
            },

            getTestGroup: function() {
                var cxId = cX.getUserId();
                var newBucket = -1;
                if (cxId && cxId.length) {
                    var newHash = 0;

                    for (var i = 0; i < cxId.length; i++) {
                        newHash = ((newHash << 5) - newHash) + cxId.charCodeAt(i);
                        newHash |= 0;
                    }

                    newBucket = Math.abs(newHash) % 100;
                } else {
                    newBucket = Math.floor(Math.random() * 100);
                }

                return newBucket;
            },

            _applyContext: function(context, widgetParams) {
                if (!context) {
                    context = {};
                }

                if (!context.context) {
                    context.context = {};
                }

                if (!context.context.categories) {
                    context.context.categories = {};
                }

                if (!context.context.parameters) {
                    context.context.parameters = [];
                }

                var newContextCategories = {};
                cX.Object.forEach(context.context.categories, function(value, key) {
                    if (value !== undefined) {
                        var found = false;
                        var k = key.toLowerCase();
                        newContextCategories[k] = value;
                        cX.Object.forEach(context.context.parameters, function(param) {
                            found = found || param.key === k;
                        });
                        if (!found) {
                            context.context.parameters.push({key: k, value: '' + value});
                        }
                    }
                });
                context.context.categories = newContextCategories;

                cX.Object.forEach(cX.library.m_rawCustomParameters, function(value, key) {
                    if (key && value !== undefined) {
                        if (!cX.Object.some(context.context.parameters, function(param) {
                            return param.key === key;
                        })) {
                            if (cX.isArray(value)) {
                                cX.Array.forEach(value, function(elem){
                                    context.context.parameters.push({key: key, value: '' + elem});
                                });
                            } else {
                                context.context.parameters.push({key: key, value: '' + value});
                            }
                        }
                    }
                });
                cX.Array.forEach(this.utmParams, function(utmParam) {
                    context.context.parameters.push({key: utmParam.key, value: '' + utmParam.value});
                });

                if (this.previewId === widgetParams.widgetId && this.previewCampaign) {
                    context['tag'] = this.previewCampaign;
                }

                if (this.testGroup === -1) {
                    this.testGroup = this.getTestGroup();
                }

                context.context.categories.testgroup = '' + this.testGroup;
                context.context.parameters.push({key: 'testgroup', value: '' + this.testGroup});
                if (widgetParams && widgetParams.targetElementId) {
                    var element = document.getElementById(widgetParams.targetElementId);
                    if (element) {
                        var uniqueLinks = {};
                        var links = [].slice.call(element.querySelectorAll(widgetParams && widgetParams.ctrlLinksCss || 'a'));
                        for (var i = 0; i < links.length; i++) {
                            var link = links[i];
                            var linkValue = this._getElemLink(link, widgetParams && widgetParams.ctrlSpaAttr);
                            if (link && linkValue) {
                                uniqueLinks[linkValue] = null;
                            }
                        }
                        var index = 1;
                        for (var uniqueLink in uniqueLinks) {
                            if (uniqueLinks.hasOwnProperty(uniqueLink)) {
                                context.context.parameters.push({key: 'ctrlUrl' + (index++), value: uniqueLink});
                            }
                        }
                    }
                }

                if (this.noCache) {
                    context.context.uncachedSettings = true;
                }
                return context;
            },

            reportTestImpression: function(testId, testVariant) {
                // Must be removed after a few iterations
            },

            _reportWidgetVisible: function(testId, testVariant, items) {
                for (var i = 0; i < items.length; ++i) {
                    var item = items[i];
                    if (item.click_url) {
                        var requestObject = {
                            'impressions': [
                                {'clickUrl': item.click_url, 'visibilitySeconds': 1}
                            ]
                        };
                        var url = 'https://api.cxense.com/public/widget/visibility?callback={{callback}}' +
                            '&json=' + encodeURIComponent(cX.JSON.stringify(requestObject));
                        cX.jsonpRequest(url, function(result) {
                        }, {synchronous: false});
                    }
                }
            },

            trackVisibility: function(divId, testId, testVariant, items) {
                var element = document.getElementById(divId);
                if (!element) {
                    return;
                }

                if (testId !== null && items) {
                    var elements = element.getElementsByClassName('cx-visibility-element');
                    if (elements && elements.length === 1) {
                        element = elements[0];
                    }

                    cX.trackElement({
                        element: element,
                        trigger: {
                            on: cX.createDelegate(this, function(state) {
                                return state.visibility[this.visibilityField] >= this.trackTime;
                            }),
                            callback: cX.createDelegate(this, function(state) {
                                this._reportWidgetVisible(testId, testVariant, items);
                            })
                        }
                    });
                }
            },

            _instrumentClickLinks: function(widgetParams, testId, testVariant, items) {
                var divId = widgetParams && widgetParams.targetElementId;
                var ctrlLinksCss = widgetParams && widgetParams.ctrlLinksCss || 'a';
                var ctrlSpaAttr = widgetParams && widgetParams.ctrlSpaAttr;
                var element = document.getElementById(divId);
                if (!element) {
                    return;
                }
                var links = [].slice.call(element.querySelectorAll(ctrlLinksCss)).filter(cX.createDelegate(this, function(elem) {
                    return this._getElemLink(elem, ctrlSpaAttr);
                }));

                for (var i = 0; i < links.length; ++i) {
                    var link = links[i];
                    var linkValue = this._getElemLink(link, ctrlSpaAttr);
                    var instrumented = false;
                    if (items) {
                        for (var j = 0; j < items.length; ++j) {
                            var item = items[j];
                            if (item.click_url && linkValue === item.url) {
                                this._ctrlClickTracker(item.click_url, link, ctrlSpaAttr);
                                instrumented = true;
                                break;
                            }
                        }
                    }
                    if (!instrumented) {
                        var urlData = 'cx_testId=' + encodeURIComponent(testId) +
                            '&cx_testVariant=' + encodeURIComponent(testVariant);
                        linkValue += (linkValue.indexOf('#') < 0 ? '#' : '&') + urlData + '&cx_artPos=' + i;
                        if (ctrlSpaAttr) {
                            link.setAttribute(ctrlSpaAttr, linkValue);
                        } else {
                            link.href = linkValue;
                        }
                    }
                }
            },

            instrumentClickLinks: function(divId, testId, testVariant) {
                this._instrumentClickLinks({
                    targetElementId: divId
                }, testId, testVariant);
            },

            _getElemLink: function(elem, ctrlLinkAttribute) {
                if (ctrlLinkAttribute) {
                    return elem.getAttribute(ctrlLinkAttribute);
                }
                return elem.href;
            },

            _updateClickUrls: function(items) {
                if (items) {

                    for (var i = 0; i < items.length; ++i) {
                        var item = items[i];
                        if (item.click_url) {

                            if (!this._isEmptyType(item.type)) {
                                var testId = item.testId || '0';
                                var testVariant = item.type === 'ctrl' ? 'ctrl' : 'cx_' + (item.campaign || 0);

                                item.click_url += '?cx_testId=' + testId + '&cx_testVariant=' + testVariant + '&cx_artPos=' + i;

                                if (item.tag) {
                                    item.click_url += '&cx_tag=' + item.tag;
                                }
                                if (item._type) {
                                    item.click_url += '&cx_type=' + item._type;
                                }
                                if (item.offerProductId){
                                    item.click_url += '&cx_productId=' + item.offerProductId;
                                }
                            }

                        }
                    }
                }
            },

            updateRecsClickUrls: function(testId, testVariant, items) {
                if (items) {
                    for (var i = 0; i < items.length; ++i) {
                        var item = items[i];
                        if (item.click_url) {
                            item.click_url += '?cx_testId=' + testId + '&cx_testVariant=' + testVariant + '&cx_artPos=' + i;

                            if (item.tag) {
                                item.click_url += '&cx_tag=' + item.tag;
                            }
                        }
                    }
                }
            },

            _ctrlClickTracker: function(clickUrl, linkElem, spaSupport) {
                if (!spaSupport) {
                    return cX.clickTracker(clickUrl, linkElem);
                } else {
                    window.requestAnimationFrame(function() {
                        cX.addEventListener(linkElem, 'click', function() {
                            cX.sendSpaRecsClick(clickUrl);
                        });
                    });
                }
            },

            clickTracker: function(item, callback, redirectParams) {
                var clickUrl;
                if (item && item.click_url) {
                    clickUrl = item.click_url;
                }
                if (callback) {
                    var linkId = 'cXLinkId' + cX.library._randomString();
                    window.requestAnimationFrame(function() {
                        var linkEl = document.getElementById(linkId);

                        if (linkEl) {
                            cX.addEventListener(linkEl, 'mousedown', function() {
                                linkEl.removeAttribute('href');
                            });
                            cX.addEventListener(linkEl, 'touchstart', function() {
                                linkEl.removeAttribute('href');
                            });
                            cX.addEventListener(linkEl, 'click', function() {
                                cX.sendSpaRecsClick(clickUrl, function() {
                                    callback(item, redirectParams);
                                });
                            });
                        } else {
                            console.log("Missing linkId: " + linkId);
                        }
                    });
                    return linkId;
                } else {
                    var queryPos = clickUrl.indexOf('?');
                    if (queryPos === clickUrl.length - 1) {
                        clickUrl = clickUrl.substring(0, clickUrl.length - 1);
                    }
                    var redirectQuery = '';
                    if (redirectParams) {
                        cX.Object.forEach(redirectParams, function(value, key) {
                            if (value !== undefined) {
                                redirectQuery += (redirectQuery || queryPos >= 0 ? '&' : '?') + key + '=' + value;
                            }
                        });
                    }
                    var fragmentPos = clickUrl.indexOf('#');
                    if (fragmentPos >= 0) {
                        clickUrl = clickUrl.substring(0, fragmentPos) + redirectQuery + clickUrl.substring(fragmentPos);
                    } else {
                        clickUrl = clickUrl + redirectQuery;
                    }
                    return cX.clickTracker(clickUrl);
                }
            },

            getDivId: function(className) {
                if (className && className.length) {
                    var testCandidates = document.getElementsByClassName(className);
                    if (testCandidates && testCandidates.length === 1) {
                        var div = testCandidates[0];

                        if (!(div.id && div.id.length)) {
                            div.id = className + '-01';
                        }
                        return div.id;
                    }
                }
                return null;
            },

            _processResult: function(widgetParams, items) {

                if (items && items.length) {
                    var item = items[0];

                    if (!this._isEmptyType(item.type)) {

                        var testId = item.testId || '0';
                        var testVariant = item.type === 'ctrl' ? 'ctrl' : 'cx_' + (item.campaign || 0);

                        if (item.type === 'ctrl') {
                            this._instrumentClickLinks(widgetParams, testId, testVariant, items);
                        }
                        this.trackVisibility(widgetParams && widgetParams.targetElementId, testId, testVariant, items);
                    }
                }
            },

            processCxResult: function(testId, divId) {
                var element = document.getElementById(divId);
                if (!element) {
                    return;
                }
                var cxDivId = null;
                if (element.previousElementSibling) {
                    cxDivId = element.previousElementSibling.id;
                    if (element.className === 'template') {
                        element.parentNode.removeChild(element);
                    }
                }
                this.trackVisibility(cxDivId || divId, testId, 'cx');
            },

            _isEmptyType: function(type) {
                return ['noImpact', 'noVisual', 'free', 'abTest', 'piano'].indexOf(type) >= 0;
            },

            _isIgnoredResponse: function(data) {
                if (data && data.response && data.response.items && data.response.items.length) {
                    return this._isEmptyType(data.response.items[0].type);
                }
                return true;
            },

            _addTemplate: function(divId, content) {
                var templ = document.createElement('div');
                templ.id = divId;
                templ.className = 'template';
                templ.setAttribute('style', 'display: none;');
                templ.innerHTML = content;
                document.body.appendChild(templ);
            },

            displayResult: function(divId, data, context) {

                if (data.response.items && data.response.items.length) {
                    if (data.response.items[0].type === 'ctrl') {
                        return;
                    }
                }

                var template = data.response.template;
                var rawStyle = data.response.style;
                var rawCode = data.response.head;

                if (rawStyle && rawStyle.length) {
                    var style = document.createElement('style');

                    style.type = 'text/css';
                    if (style.styleSheet) {
                        style.styleSheet.cssText = rawStyle;
                    } else {
                        style.appendChild(document.createTextNode(rawStyle));
                    }
                    document.getElementsByTagName('head')[0].appendChild(style);
                }

                if (rawCode && rawCode.length) {
                    var codeObj = document.createElement('script');
                    codeObj.type = 'text/javascript';
                    codeObj.text = rawCode;
                    document.getElementsByTagName('head')[0].appendChild(codeObj);
                }

                var templateDiv = 'cx-' + cX.getRandomString() + '-tmp';

                this._addTemplate(templateDiv, template);

                var target = divId ? divId : templateDiv + '-dst';

                if (!divId) {
                    var dest = document.createElement('div');
                    dest.id = templateDiv + '-dst';
                    dest.className = 'template';
                    dest.setAttribute('style', 'display: none;');
                    document.body.appendChild(dest);
                }

                if (this.snapPoints.length) {
                    if (!context) {
                        context = {};
                    }
                    context.activeSnapPoint = this._getSnapPoint();
                    this.activeWidgets.push({
                        templateId: templateDiv,
                        targetId: target,
                        data: data,
                        context: context,
                        templateContent: template
                    });
                }

                cX.renderTemplate(templateDiv, target, data, context);
            },

            runCxVersion: function(testId, divId, widgetParams, context, callback) {
                if (widgetParams.renderTemplateUrl) {
                    widgetParams.insertBeforeElementId = divId;
                    widgetParams.testId = testId;
                    widgetParams.testVariant = 'cx';
                    widgetParams.onImpressionResult = cX.createDelegate(this, function() {
                        this.processCxResult(testId, divId, context);
                        if (callback) {
                            callback();
                        }
                    });
                } else {
                    if (!widgetParams.renderFunction) {
                        widgetParams.renderFunction = cX.createDelegate(this, function(data, context) {
                            if (testId) {
                                this.updateRecsClickUrls(testId, 'cx', data.response.items);
                            }
                            this.displayResult(divId, data);
                            this.processCxResult(testId, divId);
                            if (callback) {
                                // data and context only available when running in-page
                                callback(data, context);
                            }
                        });
                    } else {
                        var origRenderFunc = widgetParams.renderFunction;
                        widgetParams.renderFunction = cX.createDelegate(this, function(data, context) {
                            this.updateRecsClickUrls(testId, 'cx', data.response.items);
                            this.processCxResult(testId, divId);
                            origRenderFunc(data, context);
                            if (callback) {
                                callback(data, context);
                            }
                        });
                    }
                }

                context = this._applyContext(context, widgetParams);
                cX.insertWidget(widgetParams, context);
            },

            displayWidget: function(divId, widgetParams, context, callback) {
                this.runCxVersion(null, divId, widgetParams, context, callback);
            },

            runCtrlVersion: function(testId, divId, callback) {
                this.instrumentClickLinks(divId, testId, 'ctrl');
                this.trackVisibility(divId, testId, 'ctrl');
                if (callback) {
                    setTimeout(callback, 1);
                }
            },

            runTest: function(testId, divId, testSize, widgetParams, context, callback) {
                if (this.testVariant === 'cx') {
                    this.runCxVersion(testId, divId, widgetParams, context, callback);
                } else if (this.testVariant === 'ctrl') {
                    this.runCtrlVersion(testId, divId, callback);
                } else if ((this.testGroup > -1) && (testSize > 0)) {
                    if (this.testGroup < testSize * 100) {
                        this.runCxVersion(testId, divId, widgetParams, context, callback);
                    } else if (this.testGroup > 100 * (1.0 - testSize)) {
                        this.runCtrlVersion(testId, divId, callback);
                    }
                } else if (callback) {
                    setTimeout(callback, 1);
                }
            },

            _renderFunction: function(data, context, widgetParams, callback) {
                if (!this._isIgnoredResponse(data)) {
                    this._updateClickUrls(data.response.items);
                    this.displayResult(widgetParams && widgetParams.targetElementId, data);
                    this._processResult(widgetParams, data.response.items);
                } else {
                    var item = data.response.items && data.response.items.length > 0 && data.response.items[0];

                    if (item && item.aid && item.type === 'piano') {
                        cX.loadScript("https://sandbox.tinypass.com/xbuilder/experience/load?aid=" + item.aid);
                    } else if (item && item.type === 'abTest') {
                        this.run({
                            targetElementId: widgetParams && widgetParams.targetElementId,
                            widgetId: item.widgetId,
                        }, null, function(abModuleData, context) {
                            callback(abModuleData, context, data);
                        });

                        return;
                    }
                }

                this._executeCallback(callback, data, context);
            },

            render: function(targetDiv, data, context, callback) {
                this._renderFunction(data, context, {
                    targetElementId: targetDiv
                }, callback);
            },

            _executeCallback: function(callback, data, context) {
                if (callback) {
                    if (typeof callback === 'function') {
                        callback(data, context);
                    } else if (typeof callback === 'string') {
                        if (window[callback] && typeof (window[callback]) === 'function') {
                            window[callback](data, context);
                        } else {
                            var functionName = 'cx_' + cX.getRandomString();
                            var codeObj = document.createElement('script');
                            codeObj.type = 'text/javascript';
                            codeObj.text = 'function ' + functionName + '(data,context) {(' + callback + ')(data,context);}';
                            document.getElementsByTagName('head')[0].appendChild(codeObj);
                            if (window[functionName] && typeof (window[functionName]) === 'function') {
                                window[functionName](data, context);
                            }
                        }
                    }
                }
            },

            run: function(widgetParams, context, callback) {
                if (!widgetParams.widgetId) {
                    throw "Please provide 'widgetId'";
                }
                var cb = callback;
                if (this['__cx-toolkit__'].isShown) {
                    this['__cx-toolkit__'].data.push({
                        widget: widgetParams.widgetId,
                        params: widgetParams,
                        responseData: null,
                        responseContext: null,
                        requestContext: context,
                        isRendered: false
                    });

                    cb = cX.createDelegate(this, function(data, context) {
                        var requests = this['__cx-toolkit__'].data;

                        for (var i = 0; i < requests.length; i++) {
                             if (requests[i].widget === widgetParams.widgetId && requests[i].params.targetElementId === widgetParams.targetElementId) {
                                 requests[i].isRendered = true;
                                 requests[i].responseData = data;
                                 requests[i].responseContext = context;
                             }
                        }

                        callback(data, context);
                    });
                }

                widgetParams.renderFunction = cX.createDelegate(this, function(data, context) {
                    this._renderFunction(data, context, widgetParams, cb);
                });

                context = this._applyContext(context, widgetParams);
                cX.insertWidget(widgetParams, context);
            },

            _runDuplicateRemoval: function(widgets, duplicateRemovalKey, alreadyDisplayed) {
                if (widgets.length > 0) {
                    var currWidget = widgets.shift();

                    if (!currWidget.widgetContext) {
                        currWidget.widgetContext = {};
                    }
                    if (!currWidget.widgetContext.context) {
                        currWidget.widgetContext.context = {};
                    }
                    currWidget.widgetContext.context.neighbors = alreadyDisplayed;

                    if (widgets.length > 0) {
                        this.run(currWidget.widgetParams, currWidget.widgetContext, cX.createDelegate(this, function(data, context) {
                            if (data && data.response && data.response.items && data.response.items.length) {
                                for (var i = 0; i < data.response.items.length; i++) {
                                    var item = data.response.items[i];
                                    if (duplicateRemovalKey in item) {
                                        var artId = item[duplicateRemovalKey];
                                        if (alreadyDisplayed.indexOf(artId) === -1) {
                                            alreadyDisplayed.push(artId);
                                        }
                                    }
                                }
                                this._executeCallback(currWidget.widgetCallback, data, context);
                            }
                            this._runDuplicateRemoval(widgets, duplicateRemovalKey, alreadyDisplayed);
                        }));
                    } else {
                        this.run(currWidget.widgetParams, currWidget.widgetContext, currWidget.widgetCallback);
                    }
                }
            },


            runMulti: function(widgets, duplicateRemovalKey) {
                if (!duplicateRemovalKey) {
                    for (var i = 0; i < widgets.length; i++) {
                        this.run(widgets[i].widgetParams, widgets[i].widgetContext, widgets[i].widgetCallback);
                    }
                } else {
                    var alreadyDisplayed = [];
                    this._runDuplicateRemoval(widgets, duplicateRemovalKey, alreadyDisplayed);
                }
            },

            insertMaster: function(widgetId, context, duplicateRemovalKey) {
                cX.insertWidget({
                    widgetId: widgetId,
                    renderFunction: cX.createDelegate(this, function(data) {
                        if (data && data.response && data.response.items && data.response.items.length) {
                            var item = data.response.items[0];
                            var widgets = [];
                            if (item && item.widgets) {
                                for (var w = 0; w < item.widgets.length; w++) {
                                    var widget = item.widgets[w];
                                    if (widget.widgetId && widget.targetElementId) {
                                        widgets.push({
                                            widgetParams: {
                                                widgetId: widget.widgetId,
                                                targetElementId: widget.targetElementId
                                            }, widgetContext: context, widgetCallback: widget.callback
                                        });
                                    }
                                }
                            }
                            this.runMulti(widgets, duplicateRemovalKey);
                        }
                    })
                }, context);
            },

            _insertPreview: function() {
                if (this.previewId && this.previewDiv !== 'current') {
                    if (this.previewDiv === 'new') {
                        var div = document.createElement('div');
                        this.previewDiv = 'cx_preview_' + cX.getRandomString();
                        div.setAttribute('id', this.previewDiv);
                        document.body.insertBefore(div, document.body.firstChild);
                    }
                    this.run({'widgetId': this.previewId, 'targetElementId': this.previewDiv});
                }
            },

            _showTools: function(useLocal) {
                if (this['__cx-toolkit__'].isShown === true) { return; }

                localStorage.setItem('cX_lastP1Time', '0');

                this['__cx-toolkit__'].isShown = true;

                if ("2.36" !== 'test') {
                    var toolkitURL = (useLocal ? 'https://local.cxense.com:9001/' : 'https://rscdn.cxense.com/') + 'cxense-toolkit.js';
                    (function(d, s, u, e, t, cb) {
                        e = d.createElement(s);
                        e.type = 'text/java' + s;
                        e.async = 'async';
                        e.src = u;
                        e.onload = cb;
                        t = d.getElementsByTagName(s)[0];
                        t.parentNode.insertBefore(e, t);
                    })(document, 'script', toolkitURL, null, null, callback);
                } else {
                    callback();
                }

                function callback() { document.body.appendChild(document.createElement('cx-toolkit')); }
            },

            setTestGroup: function(testGroup) {
                this.testGroup = testGroup;
            },

            invoke: function(func) {
                func.apply(window, Array.prototype.slice.call(arguments, 1));
            },

            sendConversionEvent: function(conversionParams, options) {
                conversionParams = conversionParams || {};
                options = options || {};
                var identities = options.identities || [];
                if (!cX.Array.some(identities, function(id) {
                    return id.type === 'cx';
                })) {
                    identities.push({id: cX.getUserId(), type: 'cx'});
                }

                var requestObject = {
                    events: [Object.assign(conversionParams, {
                        eventType: 'conversion',
                        productId : conversionParams.productId || this.offerProductId,
                        rnd: cX.library._randomString(),
                        prnd: cX.library.m_rnd,
                        siteId: cX.library.m_siteId,
                        userIds: identities
                    })]
                };
                var url = this.ccePushUrl +
                    '&json=' + encodeURIComponent(cX.JSON.stringify(requestObject));
                cX.jsonpRequest(url, function(result) {
                    if (options.callback) {
                        options.callback(result, {url: url, request: requestObject});
                    }
                });
            }
        };

        (function(d, s, e, t) {
            e = d.createElement(s);
            e.type = 'text/java' + s;
            e.async = 'async';
            e.src = 'https://cdn.cxense.com/cx.js';
            t = d.getElementsByTagName(s)[0];
            t.parentNode.insertBefore(e, t);
        })(document, 'script');
    }

    function cxCCE_callQueueExecute() {
        try {
            var currCall = null;
            while (currCall = cX.CCE.callQueue.shift()) {
                try {
                    var fnName = currCall[0];
                    var fnArgs = currCall.slice(1);
                    cX.callQueue.push(['invoke', function(localName, localArgs) {
                        return function() {
                            cX.CCE.library[localName].apply(cX.CCE.library, localArgs);
                        };
                    }(fnName, fnArgs)
                    ]);
                } catch (e) {
                }
            }
        } catch (e) {
        }
    }

    setTimeout(cxCCE_callQueueExecute, 25);

    cX.CCE.callQueue.push = function() {
        Array.prototype.push.apply(this, arguments);
        setTimeout(cxCCE_callQueueExecute, 1);
        return this.length;
    };

    (function() {
        for (var propName in cX.CCE.library) {
            if (cX.CCE.library.hasOwnProperty(propName)) {
                cX.CCE[propName] = cX.CCE.library[propName];
            }
        }
    })();

    if (!window.cxTest) {
        window.cxTest = cX.CCE;
    }

} catch (e) {
    console.log(e);
}
