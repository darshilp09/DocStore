
import React, { Component } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    View,
    TouchableHighlight,
    PermissionsAndroid
} from 'react-native';
import GoogleSignIn from 'react-native-google-sign-in';
import GDrive from "react-native-google-drive-api-wrapper";
import RNFS from "react-native-fs"

let apiToken = null
const url = 'https://www.googleapis.com/drive/v3' 
const uploadUrl = 'https://www.googleapis.com/upload/drive/v3'
const downloadHeaderPath = RNFS.DocumentDirectoryPath + '/data.json' 
const boundaryString = 'foo_bar_baz' 

/**
 * query params 
 */
function queryParams() {
    return encodeURIComponent("name = 'data.json'")
}

/**
 * Set api token
 */
function setApiToken(token) {
    apiToken = token
}

/**
 * crete multi body
 */
function createMultipartBody(body, isUpdate = false) {
    const metaData = {
        name: 'data.json',
        description: 'Backup data for my app',
        mimeType: 'application/json',
    }
    // if it already exists, specifying parents again throws an error
    if (!isUpdate) metaData.parents = ['appDataFolder']

    // request body
    const multipartBody = `\r\n--${boundaryString}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
        + `${JSON.stringify(metaData)}\r\n`
        + `--${boundaryString}\r\nContent-Type: application/json\r\n\r\n`
        + `${JSON.stringify(body)}\r\n`
        + `--${boundaryString}--`

    return multipartBody
}


/**
 * configure post method
 */
function configurePostOptions(bodyLength, isUpdate = false) {
    const headers = new Headers()
    headers.append('Authorization', `Bearer ${apiToken}`)
    headers.append('Content-Type', `multipart/related; boundary=${boundaryString}`)
    headers.append('Content-Length', bodyLength)
    return {
        method: isUpdate ? 'PATCH' : 'POST',
        headers,
    }
}

/**
 * configure get method
 */
function configureGetOptions() {
    const headers = new Headers()
    headers.append('Authorization', `Bearer ${apiToken}`)
    return {
        method: 'GET',
        headers,
    }
}

/**
 * create download url based on id
 */
function downloadFile(existingFileId) {
    const options = configureGetOptions()
    console.log(existingFileId)
    if (!existingFileId) throw new Error('Didn\'t provide a valid file id.')
    return `${url}/files/${existingFileId}?alt=media`
}

/**
 * returns the files meta data only. the id can then be used to download the file
 */
function getFile() {
    const qParams = queryParams()
    const options = configureGetOptions()
    console.log('options', apiToken)
    return fetch(`${url}/files?q=${qParams}&spaces=appDataFolder`, options)
        .then(parseAndHandleErrors)
        .then((body) => {
            console.log(body)
            if (body && body.files && body.files.length > 0) return body.files[0]
            return null
        })
}

/**
 * upload file to google drive
 */
function uploadFile(content, existingFileId) {
    const body = createMultipartBody(content, !!existingFileId)
    const options = configurePostOptions(body.length, !!existingFileId)
    return fetch(`${uploadUrl}/files${existingFileId ? `/${existingFileId}` : ''}?uploadType=multipart`, {
        ...options,
        body,
    })
        .then(parseAndHandleErrors)
}

/**
 * handle error
 */
function parseAndHandleErrors(response) {
    console.log(response)
    if (response.ok) {
        return response.json()
    }
    return response.json()
        .then((error) => {
            throw new Error(JSON.stringify(error))
        })
}

/**
 * require write storage permission
 */
async function requestWriteStoragePermission() {
    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
                'title': 'Write your android storage Permission',
                'message': 'Write your android storage to save your data'
            }
        )
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log("You can write storage")
        } else {
            console.log("Write Storage permission denied")
        }
    } catch (err) {
        console.warn(err)
    }
}


/**
 * * require read storage permission
 */
async function requestReadStoragePermission() {
    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            {
                'title': 'Read your android storage Permission',
                'message': 'Read your android storage to save your data'
            }
        )
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log("You can Read storage")
        } else {
            console.log("Read Storage permission denied")
        }
    } catch (err) {
        console.warn(err)
    }
}

export default class App extends Component {
    constructor(props) {
        super(props)

        this.state = {
            data: null
        }

        this.checkPermission()
    }

    // check storage permission
    checkPermission = () => {
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE).then((writeGranted) => {
            console.log('writeGranted', writeGranted)
            if (!writeGranted) {
                requestWriteStoragePermission()
            }
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE).then((readGranted) => {
                console.log('readGranted', readGranted)
                if (!readGranted) {
                    requestReadStoragePermission()
                }
            })
        })
    }

    // download and read file to get data content in downloaded file
    downloadAndReadFile = (file) => {
        const fromUrl = downloadFile(file.id)
        let downloadFileOptions = {
            fromUrl: fromUrl,
            toFile: downloadHeaderPath,
        }
        downloadFileOptions.headers = Object.assign({
            "Authorization": `Bearer ${apiToken}`
        }, downloadFileOptions.headers);

        console.log('downloadFileOptions', downloadFileOptions)

        RNFS.downloadFile(downloadFileOptions).promise.then(res => {
            console.log(res)
            return RNFS.readFile(downloadHeaderPath, 'utf8');
        }).then(content => {
            console.log(content)
            this.setState({
                data: content
            })
        }).catch(err => {
            console.log('error', err)
        });
    }

    // check existed file
    checkFile = () => {
        getFile().then((file) => {
            console.log('file', file)
            if (file) {
                this.downloadAndReadFile(file)
            } else {
                console.log('file no found')
            }
        }).catch((error) => {
            console.log('error', error)
        })
    }

    // crete file to upload
    createFile = () => {
        const content = [
            {
                id: 1,
                text: 'transaction memo list',
                name: 'dang'
            },
            {
                id: 2,
                text: 'transaction memo list',
                name: 'dang 2'
            }
        ]
        getFile().then((file) => {
            console.log('file', file)
            if (file) {
                uploadFile(JSON.stringify(content), file.id)
            } else {
                uploadFile(JSON.stringify(content))
            }
        }).catch((error) => {
            console.log('error', error)
        })
    }

    getDataFromGoogleDrive = async () => {
        await this.initialGoogle()

        if (apiToken) {
            this.checkFile()
        }
    }

    setDataFromGoogleDrive = async () => {
        await this.initialGoogle()

        if (apiToken) {
            this.createFile()
        }
    }

    initialGoogle = async () => {
        await GoogleSignIn.configure({
            scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            shouldFetchBasicProfile: true,
            offlineAccess: true
        });

        const user = await GoogleSignIn.signInPromise();
        //set api token
        setApiToken(user.accessToken)
    }

    render() {
        return (
            <View style={styles.container}>
                <TouchableHighlight style={styles.buttonGetData} onPress={this.getDataFromGoogleDrive}>
                    <Text style={styles.text}>
                        Get data from Google Drive
                    </Text>
                </TouchableHighlight>
                <TouchableHighlight style={styles.buttonGetData} onPress={this.setDataFromGoogleDrive}>
                    <Text style={styles.text}>
                        Create data or Update data
                    </Text>
                </TouchableHighlight>
                <Text style={styles.textData}>
                    {JSON.parse(this.state.data)}
                </Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    text: {
        textAlign: 'center',
        color: '#FFFFFF',
        margin: 10,
    },
    textData: {
        textAlign: 'center',
        color: '#333333',
        margin: 10,
    },
    buttonGetData: {
        backgroundColor: '#333',
        padding: 10,
        margin: 10,
    }
});