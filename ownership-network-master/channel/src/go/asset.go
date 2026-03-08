package main

import (
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type Asset struct {
	AssetID    string `json:"asset_id"`
	AssetName  string `json:"asset_name"`
	Quantity   int    `json:"qty"`
	Unit       string `json:"unit"`
	Condition  string `json:"condition"`
	Attachment string `json:"attachment"`
	AssignTo   string `json:"assign_to"`
	Username   string `json:"username"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"` // Set on transfer/update so history shows distinct assign vs reassign times
	DepName    string `json:"dep_name"`
}

// AssetHistoryEntry is one history record with chain identifiers for tracking (decentralized).
type AssetHistoryEntry struct {
	Asset
	TxID      string `json:"tx_id"`      // This transaction (unique per event)
	Timestamp string `json:"timestamp"`   // Fabric commit time (RFC3339)
}

func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, assetID string) (bool, error) {
	data, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return false, fmt.Errorf("failed to read asset: %v", err)
	}
	return data != nil, nil
}

func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, assetID, assetName, unit, condition, attachment, assignTo, username, depName string, qty int) (*Asset, error) {
	// Check if the asset already exists
	exists, err := s.AssetExists(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("error checking asset existence: %v", err)
	}
	if exists {
		return nil, fmt.Errorf("asset %s already exists", assetID)
	}

	// Proceed to create the asset since it does not exist
	now := time.Now().String()
	asset := Asset{
		AssetID:    assetID,
		AssetName:  assetName,
		Quantity:   qty,
		Unit:       unit,
		Condition:  condition,
		Attachment: attachment,
		AssignTo:   assignTo,
		Username:   username,
		CreatedAt:  now,
		UpdatedAt:  now,
		DepName:    depName,
	}

	// Save the asset to the ledger
	if err := PutState(ctx, assetID, asset); err != nil {
		return nil, fmt.Errorf("failed to create asset in ledger: %v", err)
	}

	return &asset, nil
}




// QueryAsset retrieves an asset by ID
func (s *SmartContract) QueryAsset(ctx contractapi.TransactionContextInterface, assetID string) (*Asset, error) {
	data, err := GetState(ctx, assetID)
	if err != nil || data == nil {
		return nil, fmt.Errorf("asset %s does not exist", assetID)
	}
	return UnmarshalAsset(data)
}

// UpdateAsset modifies an existing asset in the ledger
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, assetID, assetName, unit, condition, attachment, assignTo, username, depName string, qty int) (*Asset, error) {
	asset, err := s.QueryAsset(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query asset: %v", err)
	}

	// Update the asset fields with new values
	asset.AssetName = assetName
	asset.Quantity = qty
	asset.Unit = unit
	asset.Condition = condition
	asset.Attachment = attachment
	asset.AssignTo = assignTo
	asset.Username = username
	asset.DepName = depName
	asset.UpdatedAt = time.Now().String()

	// Save the updated asset back to the ledger
	if err := PutState(ctx, assetID, asset); err != nil {
		return nil, fmt.Errorf("failed to update asset in ledger: %v", err)
	}
	
	return asset, nil
}

// DeleteAsset removes an asset from the ledger
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, assetID string) error {
	return ctx.GetStub().DelState(assetID)
}

// GetAssetHistory retrieves the historical changes of a specific asset by assetID.
// Each entry includes tx_id and timestamp so clients can build chain: first tx → previous tx → this tx.
func (s *SmartContract) GetAssetHistory(ctx contractapi.TransactionContextInterface, assetID string) ([]*AssetHistoryEntry, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to get asset history: %v", err)
	}
	defer resultsIterator.Close()

	var history []*AssetHistoryEntry
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate through asset history: %v", err)
		}

		entry := &AssetHistoryEntry{TxID: response.GetTxId()}
		if response.Timestamp != nil {
			entry.Timestamp = response.Timestamp.AsTime().Format(time.RFC3339)
		}
		if response.GetIsDelete() {
			entry.Asset = Asset{AssetID: assetID}
		} else {
			asset, err := UnmarshalAsset(response.Value)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal asset history: %v", err)
			}
			entry.Asset = *asset
		}
		history = append(history, entry)
	}

	return history, nil
}

func (s *SmartContract) QueryAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
  
    resultsIterator, err := ctx.GetStub().GetStateByRange("", "~")
    if err != nil {
        return nil, fmt.Errorf("failed to get all assets: %v", err)
    }
    defer resultsIterator.Close()

    var assets []*Asset
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, fmt.Errorf("failed to iterate over assets: %v", err)
        }

        fmt.Printf("Raw asset data from ledger: %s\n", string(queryResponse.Value)) // Log raw data for debugging

        asset, err := UnmarshalAsset(queryResponse.Value)
        if err != nil {
            fmt.Printf("Skipping invalid asset record: %s, error: %v\n", string(queryResponse.Value), err)
            continue 
        }

        if asset.AssetID == "" || asset.AssetName == "" {
            fmt.Printf("Skipping asset with missing required fields: %s\n", string(queryResponse.Value))
            continue 
        }
        assets = append(assets, asset)
    }

    if len(assets) == 0 {
        fmt.Println("No valid assets found.")
    } else {
        fmt.Printf("Found %d valid assets.\n", len(assets))
    }

    return assets, nil
}

// TransferAsset transfers an asset to a new user by updating the AssignTo field
// Validates that the asset exists and the newAssignTo is not empty
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, assetID, newAssignTo string) (*Asset, error) {
	// Validate input parameters
	if assetID == "" {
		return nil, fmt.Errorf("asset ID cannot be empty")
	}
	if newAssignTo == "" {
		return nil, fmt.Errorf("new assignee cannot be empty")
	}

	// Query the asset to ensure it exists
	asset, err := s.QueryAsset(ctx, assetID)
	if err != nil {
		return nil, fmt.Errorf("failed to query asset: %v", err)
	}

	// Prevent transferring to the same owner
	if asset.AssignTo == newAssignTo {
		return nil, fmt.Errorf("asset is already assigned to user %s", newAssignTo)
	}

	// Update AssignTo and set UpdatedAt so history shows distinct assign vs reassign times
	asset.AssignTo = newAssignTo
	asset.UpdatedAt = time.Now().String()

	// Save the updated asset back to the ledger
	if err := PutState(ctx, assetID, asset); err != nil {
		return nil, fmt.Errorf("failed to update asset in ledger: %v", err)
	}

	return asset, nil
}