function array_from_objects_list(objects_list, attribute) {
    var results = [];
    for (var i = 0; i < objects_list.length; i++) {
        results.push(objects_list[i][attribute])
    }
    return results;
}

function objects_attribute_contains_value(objects_list, attribute, value){
    for (var i = 0; i < objects_list.length; i++) {
        if(objects_list[i][attribute] == value)
        return true;
    }
    return false;
}

function dict_from_objects(objects_list, key, value){
    var results = {};
    for (var i = 0; i < objects_list.length; i++){
        results[objects_list[i][key]] = objects_list[i][value];
    }
    return results;
}

function key_from_value(dict, desired_value){
    for (const [key, value] of Object.entries(dict)) {
        if (value == desired_value)
            return key;
    }
    return null;
}