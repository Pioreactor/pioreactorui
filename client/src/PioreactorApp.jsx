import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import Snackbar from '@material-ui/core/Snackbar';
import Link from '@material-ui/core/Link';
import UpdateIcon from '@material-ui/icons/Update';
import Divider from '@material-ui/core/Divider';
import HistoryIcon from '@material-ui/icons/History';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import Header from "./components/Header"


const useStyles = makeStyles((theme) => ({
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
  },
}));


function PageHeader(props) {
  const classes = useStyles();
  const [version, setVersion] = React.useState("")
  const [latestVersion, setLatestVersion] = React.useState("")
  const [openSnackbar, setOpenSnackbar] = React.useState(false)

  const updateVersion = () => {
    setOpenSnackbar(true)
    fetch("/update_app")
    .then(res => {
      if (res.ok) {
        window.location.reload();
        return false
      }
    })
  }

  React.useEffect(() => {
    async function getCurrentApp() {
         await fetch("/get_app_version")
        .then((response) => {
          return response.text();
        })
        .then((data) => {
          setVersion(data)
        });
      }

    async function getLatestVersion() {
         await fetch("https://api.github.com/repos/pioreactor/pioreactor/releases/latest")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setLatestVersion(data['name'])
        });
      }

      getCurrentApp()
      getLatestVersion()
  }, [])

  return (
    <React.Fragment>
    <div>
      <div style={{display: "flex", justifyContent: "space-between", marginBottom: "5px"}}>
        <Typography variant="h5" component="h1">
          <Box fontWeight="fontWeightBold">
            PioreactorApp
          </Box>
        </Typography>
        <div >
          <Button onClick={updateVersion} style={{textTransform: 'none', float: "right", marginRight: "0px"}} color="primary">
            <UpdateIcon className={classes.textIcon}/> Update to latest release
          </Button>
          <Link color="inherit" underline="none" href="https://github.com/Pioreactor/pioreactor/releases" target="_blank" rel="noopener">
            <Button style={{textTransform: 'none', float: "right", marginRight: "0px"}} color="primary">
              <ExitToAppIcon className={classes.textIcon}/> View latest release
            </Button>
          </Link>
        </div>
      </div>
      <Divider/>
      <Typography variant="subtitle2">
        <Box fontWeight="fontWeightBold" style={{margin: "10px 2px 10px 2px", display:"inline-block"}}>
          <HistoryIcon style={{ fontSize: 12, verticalAlign: "middle" }}/> Version installed:
        </Box>
        <Box fontWeight="fontWeightRegular" style={{marginRight: "20px", display:"inline-block"}}>
          {version}
        </Box>
        <Box fontWeight="fontWeightBold" style={{margin: "10px 2px 10px 2px", display:"inline-block"}}>
          <UpdateIcon style={{ fontSize: 12, verticalAlign: "middle" }}/> Latest version available:
        </Box>
        <Box fontWeight="fontWeightRegular" style={{marginRight: "20px", display:"inline-block"}}>
          {latestVersion}
        </Box>
      </Typography>
    </div>
    <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      message={"Updating software"}
      autoHideDuration={20000}
      key={"snackbar-update"}
    />
    </React.Fragment>
  )
}



function ChangelogContainer(){
  const classes = useStyles();

  const [changelog, setChangelog] = React.useState("")

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_changelog")
        .then((response) => {
          return response.text();
        })
        .then((data) => {
          setChangelog(data)
        });
      }
      getData()
  }, [])


  return(
    <React.Fragment>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
        <Typography variant="h6" component="h6">
            Change log
        </Typography>
          <div dangerouslySetInnerHTML={{ __html: changelog }} />
        </CardContent>
      </Card>
    </React.Fragment>
)}


function PioreactorApp() {
    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item md={12} xs={1}/>
          <Grid item md={12} xs={1}/>

          <Grid item md={1} xs={1}/>
          <Grid item md={10} xs={12}>
            <PageHeader/>
            <ChangelogContainer/>
          </Grid>
          <Grid item md={1} xs={1}/>
        </Grid>
    )
}

export default PioreactorApp;

