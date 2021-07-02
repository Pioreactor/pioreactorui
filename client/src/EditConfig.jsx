import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import Snackbar from '@material-ui/core/Snackbar';
import Select from '@material-ui/core/Select';
import CircularProgress from '@material-ui/core/CircularProgress';

import { CodeFlaskReact } from "react-codeflask"

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: "15px"
  },
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
}));

class EditableCodeDiv extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      code: "",
      openSnackbar: false,
      filename: "config.ini",
      snackbarMsg: "",
      buttonText: "Save",
      hasChangedSinceSave: true,
      availableConfigs: [
        {name: "shared config.ini", filename: "config.ini"},
      ]
    };
    this.saveCurrentCode = this.saveCurrentCode.bind(this);
    this.deleteConfig = this.deleteConfig.bind(this);
  }

  async getConfig(filename) {
    await fetch("/get_config/" + filename)
      .then(response => {
        return response.text();
      })
      .then(text => {
        this.setState({code: text});
      })
  }

  async getListOfConfigFiles(filename) {
    await fetch("/get_configs")
      .then(response => {
        return response.json();
      })
      .then(json => {
        this.setState(prevState => ({
          availableConfigs: [...prevState.availableConfigs, ...json.filter(e => (e !== 'config.ini')).map(e => ({name: e, filename: e}))]
        }));
      })
  }

  saveCurrentCode() {
    this.setState({buttonText: <CircularProgress color="inherit" size={24}/>})
    fetch('/save_new_config',{
        method: "POST",
        body: JSON.stringify({code :this.state.code, filename: this.state.filename}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    .then(res => {
      if (res.ok) {
        this.setState({snackbarMsg: this.state.filename + " saved and synced.", hasChangedSinceSave: false, buttonText: "Saved"})
      } else {
        this.setState({snackbarMsg: "Hm. Something when wrong saving or syncing...", hasChangedSinceSave: true, buttonText: "Save"})
      }
      this.setState({openSnackbar: true});
    })
  }

  deleteConfig(){
    fetch('/delete_config',{
        method: "POST",
        body: JSON.stringify({filename: this.state.filename}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    .then(res => {
      if (res.ok) {
        this.setState({snackbarMsg: this.state.filename + " deleted."})
      } else {
        this.setState({snackbarMsg: "Hm. Something when wrong deleting..."})
      }
      this.setState({openSnackbar: true});
      setTimeout(function () {
        window.location.reload();
      }, 750);
    })
  }

  componentDidMount() {
    this.getConfig(this.state.filename)
    this.getListOfConfigFiles()
  }

  onSelectionChange = (e) => {
    this.setState({filename: e.target.value})
    this.getConfig(e.target.value)
  }

  getCodeFlaskRef = (codeFlask) => {
    this.codeFlask = codeFlask
  }

  onTextChange = (code) => {
    this.setState({code: code, hasChangedSinceSave: true, buttonText: "Save"})
  }

  handleSnackbarClose = () => {
    this.setState({openSnackbar: false});
  };

  render() {
    return (
      <React.Fragment>
        <div>
          <Select
            style={{margin: "10px 10px 10px 10px"}}
            native
            variant="standard"
            value={this.state.filename}
            onChange={this.onSelectionChange}
            inputProps={{
              name: 'config',
              id: 'config',
            }}
          >
            {this.state.availableConfigs.map((v) => {
              return <option key={v.filename} value={v.filename}>{v.name}</option>
              }
            )}
          </Select>
        </div>

        <div style={{letterSpacing: "0em", margin: "10px auto 10px auto", position: "relative", width: "98%", height: "300px", border: "1px solid #ccc"}}>
          <CodeFlaskReact
            code={this.state.code}
            onChange={this.onTextChange}
            editorRef={this.getCodeFlaskRef}
            language={"python"}
          />
        </div>
        <div style={{display: "flex", justifyContent: "space-between"}}>
          <Button
            style={{margin: "5px 12px 5px 12px"}}
            color="primary"
            variant="contained"
            onClick={this.saveCurrentCode}
            disabled={!this.state.hasChangedSinceSave}
            >
            {this.state.buttonText}
          </Button>
          <Button
            style={{margin: "5px 10px 5px 10px"}}
            color="secondary"
            onClick={this.deleteConfig}
            disabled={(this.state.filename === "config.ini")}>
            Delete config file
          </Button>
        </div>
        <Snackbar
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
          open={this.state.openSnackbar}
          onClose={this.handleSnackbarClose}
          message={this.state.snackbarMsg}
          autoHideDuration={2000}
          key={"edit-config-snackbar"}
        />
      </React.Fragment>
    )
  }
}




function EditConfigContainer(){
  const classes = useStyles();

  return(
    <React.Fragment>
      <div>
        <div>
          <Typography variant="h5" component="h2">
            <Box fontWeight="fontWeightBold">
              Configuration
            </Box>
          </Typography>
        </div>
      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <p>Update the <code>config.ini</code> files. The shared <code>config.ini</code> will be deployed to <em>all</em> Pioreactors, but configuration can be overwritten by editing specific Pioreactor's <code>config.ini</code>.</p>
          <EditableCodeDiv/>
          <p style={{textAlign: "center", marginTop: "30px"}}><span role="img">💡</span> Learn more about Pioreactor  <a href="https://pioreactor.com/pages/Configuration-via-config-ini" target="_blank" rel="noopener noreferrer">configuration</a>.</p>
        </CardContent>
      </Card>
    </React.Fragment>
)}


function EditConfig(props) {
    React.useEffect(() => {
      document.title = props.title;
    }, [props.title])
    return (
        <Grid container spacing={2} >
          <Grid item md={12} xs={12}>
             <EditConfigContainer/>
          </Grid>
        </Grid>
    )
}

export default EditConfig;

