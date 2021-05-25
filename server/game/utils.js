
module.exports = {
    array_from_objects_list: function (objects_list, attribute) {
        var results = [];
        for (var i = 0; i < objects_list.length; i++) {
            results.push(objects_list[i][attribute])
        }
        return results;
    },

    objects_attribute_contains_value: function (objects_list, attribute, value) {
        for (var i = 0; i < objects_list.length; i++) {
            if (objects_list[i][attribute] == value)
                return true;
        }
        return false;
    },

    dict_from_objects: function (objects_list, key, value) {
        var results = {};
        for (var i = 0; i < objects_list.length; i++) {
            results[objects_list[i][key]] = objects_list[i][value];
        }
        return results;
    },

    key_from_value: function (dict, desired_value) {
        for (const [key, value] of Object.entries(dict)) {
            if (value == desired_value)
                return key;
        }
        return null;
    },

    toTitleCase: function (string) {
        return string.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
    },

    shuffle: function (array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

            // swap elements array[i] and array[j]
            // we use "destructuring assignment" syntax to achieve that
            // you'll find more details about that syntax in later chapters
            // same can be written as:
            // let t = array[i]; array[i] = array[j]; array[j] = t
            [array[i], array[j]] = [array[j], array[i]];
        }
    },
    
    bring_card_to_front: function(deck, card_name){
        var index;
        for (index = 0; index < deck.length; index++){
            if (deck[index].card_name == card_name)
                break
        }
        if (index != null)
            deck.push(deck.splice(index,1)[0]);
    }

}