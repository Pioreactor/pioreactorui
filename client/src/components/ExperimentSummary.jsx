import React from 'react'
import {makeStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import moment from "moment";
import Box from '@material-ui/core/Box';


const useStyles = makeStyles({
  root: {
    minWidth: 100,
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
});

function ExperimentSummary(props){
  const classes = useStyles();
  const [experiment, setExperiment] = React.useState("")
  const [startedAt, setStartedAt] = React.useState(moment())

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_latest_experiment")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setExperiment(data.experiment)
          setStartedAt(moment(data.timestamp, 'YYYY-MM-DD HH:mm:SS'))
        });
      }
      getData()
  }, [])

  return(
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography className={classes.title} color="textSecondary" gutterBottom>
          Experiment
        </Typography>
        <Typography variant="h5" component="h2">
          {experiment}
        </Typography>
        <Typography variant="subtitle2">
          <Box fontWeight="fontWeightRegular">
            Start date: <span title={startedAt.format("YYYY-MM-DD HH:mm:ss")}>{startedAt.format("YYYY-MM-DD")}</span>
          </Box>
        </Typography>
        <Typography variant="subtitle2" >
          <Box fontWeight="fontWeightRegular">
            Elapsed: {(moment().diff(startedAt, 'H'))}h
          </Box>
        </Typography>
      </CardContent>
    </Card>
  )
}


export default ExperimentSummary;
