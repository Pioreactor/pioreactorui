import { Hashicon } from "@emeraldpay/hashicon-react";
import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Snackbar from '@material-ui/core/Snackbar';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import DeleteIcon from '@material-ui/icons/Delete';
import Avatar from '@material-ui/core/Avatar';
import GetAppIcon from '@material-ui/icons/GetApp';

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
  pluginList:{
    width: "95%",
    margin: "auto",
    marginBottom: "15px"
  },
  secondaryActionButton:{
    marginLeft: "10px"
  }
}));



function PageHeader(props) {
  return (
    <React.Fragment>
    <div>
      <div>
        <Typography variant="h5" component="h2">
          <Box fontWeight="fontWeightBold">
            Plugins
          </Box>
        </Typography>
      </div>
    </div>
    </React.Fragment>
  )
}



function ListAvailablePlugins({alreadyInstalledPluginsNames}){

  const classes = useStyles();
  const [availablePlugins, setAvailablePlugins] = React.useState([])
  const [snackbarOpen, setSnackbarOpen] = React.useState(false)
  const [snackbarMsg, setSnackbarMsg] = React.useState("")


  React.useEffect(() => {
    async function getData() {
         await fetch("https://raw.githubusercontent.com/Pioreactor/list-of-plugins/main/plugins.json")
        .then((response) => {
          return response.json();
        })
        .then((json) => {
          setAvailablePlugins(json)
        });
      }
      getData()
  }, [])

  const installPlugin = (plugin_name) => () => {
      setSnackbarOpen(true);
      setSnackbarMsg(`Installing ${plugin_name} in the background...`);
      fetch('/install_plugin', {
        method: "POST",
        body: JSON.stringify({plugin_name: plugin_name}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (response.ok) {
          window.location.reload();
        } else {
          throw new Error('Installation went wrong');
        }
      })
  }

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  return (
    <React.Fragment>
    <div className={classes.pluginList}>
     <List dense={true}>
        {availablePlugins
            .filter(plugin => (!alreadyInstalledPluginsNames.includes(plugin.name)))
            .map(plugin =>
          <ListItem key={plugin.name}>
            <ListItemAvatar>
              <Avatar variant="square" style={{backgroundColor:"#FFFFFF"}}>
                <Hashicon value={plugin.name} size={40} />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={plugin.name}
              secondary={plugin.description}
              style={{maxWidth: "600px"}}
            />
            <ListItemSecondaryAction>

              <Button
                onClick={installPlugin(plugin.name)}
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                endIcon={<GetAppIcon />}
                className={classes.secondaryActionButton}
              >
                Install
              </Button>
              <Button
                href={plugin.homepage}
                target="_blank" rel="noopener"
                variant="text"
                size="small"
                color="inherit"
                aria-label="install"
                disabled={!plugin.homepage}
                endIcon={<OpenInNewIcon />}
                className={classes.secondaryActionButton}
              >
                View
              </Button>
              </ListItemSecondaryAction>

          </ListItem>,
        )}
      </List>
    </div>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={snackbarMsg}
      autoHideDuration={7000}
      resumeHideDuration={2000}
      key={"snackbar-installation"}
    />
    </React.Fragment>
  )
}



function ListInstalledPlugins({installedPlugins}){
  const [snackbarOpen, setSnackbarOpen] = React.useState(false)
  const [snackbarMsg, setSnackbarMsg] = React.useState("")
  const classes = useStyles();

  const handleSnackbarClose = () => {
    setSnackbarOpen(false)
  }

  const uninstallPlugin = (plugin_name) => () => {
      setSnackbarOpen(true);
      setSnackbarMsg(`Uninstalling ${plugin_name} in the background...`);
      fetch('/uninstall_plugin', {
        method: "POST",
        body: JSON.stringify({plugin_name: plugin_name}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (response.ok) {
          window.location.reload();
        } else {
          throw new Error('Uninstallation went wrong');
        }
      })
  }

  return (
    <React.Fragment>
    <div className={classes.pluginList}>
     <List dense={true}>
        {installedPlugins.map(plugin =>
          <ListItem key={plugin.name}>
            <ListItemAvatar>
              <Avatar variant="square" style={{backgroundColor:"#FFFFFF"}}>
                <Hashicon value={plugin.name} size={40} />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={`${plugin.name} (${plugin.version})`}
              secondary={plugin.description}
            />
            <ListItemSecondaryAction>
              <Button
                onClick={uninstallPlugin(plugin.name)}
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                endIcon={<DeleteIcon />}
                className={classes.secondaryActionButton}
              >
                Uninstall
              </Button>
              <Button
                href={plugin.homepage}
                target="_blank" rel="noopener"
                variant="text"
                size="small"
                color="inherit"
                aria-label="delete"
                disabled={!plugin.homepage}
                endIcon={<OpenInNewIcon />}
                className={classes.secondaryActionButton}
              >
                View
              </Button>
            </ListItemSecondaryAction>
          </ListItem>,
        )}
      </List>
    </div>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={snackbarOpen}
      onClose={handleSnackbarClose}
      message={snackbarMsg}
      autoHideDuration={7000}
      resumeHideDuration={2000}
      key={"snackbar-installation"}
    />
    </React.Fragment>
  )
}


function PluginContainer(){
  const classes = useStyles();

  const [installedPlugins, setInstalledPlugins] = React.useState([])

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_installed_plugins")
        .then((response) => {
          return response.json();
        })
        .then((json) => {
          setInstalledPlugins(json)
        });
      }
      getData()
  }, [])


  return(
    <React.Fragment>
      <PageHeader/>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <p> Install, manage, and discover new Pioreactor plugins created by the community. These plugins can provide new functionalities for your Pioreactor (additional hardware may be necessary), or new automations to control dosing, temperature and LED operations.</p>

         <Typography variant="h6" component="h3">
          Installed plugins
         </Typography>
          <ListInstalledPlugins installedPlugins={installedPlugins}/>


         <Typography variant="h6" component="h3">
          Available plugins from the community
         </Typography>
          <ListAvailablePlugins alreadyInstalledPluginsNames={installedPlugins.map(plugin => plugin.name)}/>


          <p style={{textAlign: "center", marginTop: "30px"}}><span role="img">💡</span> Learn more about Pioreactor  <a href="https://pioreactor.com/pages/plugins" target="_blank" rel="noopener noreferrer">plugins</a>.</p>

        </CardContent>
      </Card>
    </React.Fragment>
)}


function Plugins(props) {
    React.useEffect(() => {
    document.title = props.title;
  }, [props.title])
    return (
        <Grid container spacing={2} >
          <Grid item md={12} xs={12}>
            <PluginContainer/>
          </Grid>
        </Grid>
    )
}


export default Plugins;
