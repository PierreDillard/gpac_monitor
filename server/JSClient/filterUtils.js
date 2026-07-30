import { FILTER_PROPS_LITE, FILTER_ARGS_LITE, PID_PROPS_LITE } from './config.js';

function gpac_filter_to_object(f, full = false) {
    let jsf = {};

    for (let prop in f) {
        if (full || FILTER_PROPS_LITE.includes(prop))
            jsf[prop] = f[prop];
    }

    jsf['gpac_args'] = [];

    if (full) {
        let all_args = f.all_args(true);
        for (let arg of all_args) {
            if (arg && (full || FILTER_ARGS_LITE.includes(arg.name)))
                jsf['gpac_args'].push(arg)
        }
    }

    jsf['ipid'] = {};
    jsf['opid'] = {};

    for (let d = 0; d < f.nb_ipid; d++) {
        let pidname = f.ipid_props(d, "name");
        let jspid = {};

        f.ipid_props(d, (name, type, val) => {
            if (full || PID_PROPS_LITE.includes(name))
                jspid[name] = { 'type': type, 'val': val };
        });
        jspid["buffer"] = f.ipid_props(d, "buffer");
        jspid["buffer_total"] = f.ipid_props(d, "buffer_total");
        jspid['source_idx'] = f.ipid_source(d).idx;

        jsf['ipid'][pidname] = jspid;
    }

    for (let d = 0; d < f.nb_opid; d++) {
        let pidname = f.opid_props(d, "name");
        let jspid = {};

        f.opid_props(d, (name, type, val) => {
            if (full || PID_PROPS_LITE.includes(name))
                jspid[name] = { 'type': type, 'val': val };
        });
        jspid["buffer"] = f.opid_props(d, "buffer");
        jspid["buffer_total"] = f.opid_props(d, "buffer_total");
        jsf['opid'][pidname] = jspid;
    }

    return jsf;
}

function gpac_filter_to_minimal_object(f) {
    const minimalFilters = {
        idx: f.idx,
        name: f.name,
        type: f.type,
        status: f.status,
        itag: f.itag || null,
        ID: f.ID || null,
        nb_ipid: f.nb_ipid,
        nb_opid: f.nb_opid,
        ipid: [],
        opid: []
    };

    const hasSourceOpidIdx = typeof f.ipid_source_opid_idx === 'function';

    for (let i = 0; i < f.nb_ipid; i++) {
        minimalFilters.ipid.push({
            pid_index: i,
            name: f.ipid_props(i, "name"),
            source_idx: f.ipid_source(i).idx,
            source_opid_idx: hasSourceOpidIdx ? f.ipid_source_opid_idx(i) : -1,
            stream_type: f.ipid_props(i, "StreamType"),
            ID: f.ipid_props(i, "ID")
        });
    }
    for (let o = 0; o < f.nb_opid; o++) {
        minimalFilters.opid.push({
            pid_index: o,
            name: f.opid_props(o, "name"),
            stream_type: f.opid_props(o, "StreamType"),
            ID: f.opid_props(o, "ID")
        });
    }

    return minimalFilters;
}




function on_all_connected(cb) {
    session.post_task(() => {
        let all_filters_instances = [];

        session.lock_filters(true);
        for (let i = 0; i < session.nb_filters; i++) {
            const f = session.get_filter(i);
            if (!f.is_destroyed()) all_filters_instances.push(f);
        }
        session.lock_filters(false);

        cb(all_filters_instances);
        return false;
    });
}

export {
    gpac_filter_to_object,
    gpac_filter_to_minimal_object,
    on_all_connected,
};