import * as api from 'api'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { loadRooms } from './rooms'
import { loadItems } from './items'
import { loadTexts } from './texts'
import { extractRooms, extractFurnitures, extractImagesFromRooms, extractImagesFromFurnitures, extractImagesFromItems } from 'utils/index'
import { loadFurnitures } from './furnitures'

export const exportProject = (event) => {
    return (dispatch, getState) => {
        const zip = new JSZip();
        const state = getState()

        const roomImages = extractImagesFromRooms(state.rooms.rooms)
        const furnitureImages = extractImagesFromFurnitures(state.furnitures.furnitures)
        const itemImages = extractImagesFromItems(state.items.items)

        zip.folder('images');

        zip.file('images/placeholder/room.png',fetch(`${window.location}/assets/placeholders/room.png`).then(r => r.blob()))
        zip.file('images/placeholder/furniture.png',fetch(`${window.location}/assets/placeholders/furniture.png`).then(r => r.blob()))
        zip.file('images/placeholder/item.png',fetch(`${window.location}/assets/placeholders/item.png`).then(r => r.blob()))

        roomImages.forEach(i => {
            zip.file(`images/${i.name}`, i.file)
        })
        furnitureImages.forEach(i => {
            zip.file(`images/${i.name}`, i.file)
        })
        itemImages.forEach(i => {
            zip.file(`images/${i.name}`, i.file)
        })


        const rooms = api.exportRooms(state)
        const items = api.exportItems(state)
        const interactions = api.exportInteractions(state)
        const texts = api.exportTexts(state)

        const roomsToJSON = JSON.stringify({rooms: rooms}, null, 4)
        const itemsToJSON = JSON.stringify(items, null, 4)
        const interactionsToJSON = JSON.stringify(interactions, null, 4)
        const textsToJSON = JSON.stringify(texts, null, 4)

        zip.file('rooms.json', roomsToJSON);
        zip.file('items.json', itemsToJSON);
        zip.file('interactions.json', interactionsToJSON);
        zip.file('texts.json', textsToJSON);
        zip.generateAsync({type: 'blob'})
        .then(content => {
            saveAs(content, 'game_data.zip');
        });
    }
}

function loadZipData(zip, filename, type='string') {
    return zip.files[filename].async(type).then(data => {
        return { name: filename, data: data }
    })
}

export const importProject = (pkg) => {
    return (dispatch, getState) => {
        JSZip.loadAsync(pkg).then(zip => {

            const imageData = {}
            const jsonData = {}

            const imagePromises = []
            zip.folder('images').forEach((path, file) => {
                if (file.dir) {
                    // skip directories
                    return
                }
                imagePromises.push(loadZipData(zip, `images/${path}`, 'blob'))
            })

            Promise.all(imagePromises).then(data => {
                data.forEach(d => {
                    imageData[d.name] = URL.createObjectURL(d.data)
                })
            })

            // TODO: ensure imageData is resolved before loading json files

            const jsonPromises = []
            jsonPromises.push(loadZipData(zip, 'interactions.json'))
            jsonPromises.push(loadZipData(zip, 'texts.json'))
            jsonPromises.push(loadZipData(zip, 'items.json'))
            jsonPromises.push(loadZipData(zip, 'rooms.json'))

            Promise.all(jsonPromises).then((data) => {
                // json files have been loaded, data is now usable

                data.forEach(d => { jsonData[d.name] = JSON.parse(d.data) })

                // TODO: map json image src's to objectURLs in imageData

                dispatch(loadTexts(jsonData['texts.json']))
                dispatch(loadItems(jsonData['items.json']))

                const rooms = extractRooms(jsonData['rooms.json'].rooms)
                const furnitures = extractFurnitures(jsonData['rooms.json'].rooms, jsonData['interactions.json'], jsonData['texts.json'])
                dispatch(loadRooms(rooms))
                dispatch(loadFurnitures(furnitures))
            })

        })
    }
}
